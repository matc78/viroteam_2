import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/member_fee_status.dart';
import 'package:viro_team_v2/services/fee/fee_paths.dart';

/// Mutations admin des fiches cotisation membres.
class FeeMemberOperations {
  /// Crée le module de mutations des fiches cotisation.
  FeeMemberOperations({required FeePaths paths}) : _paths = paths;

  final FeePaths _paths;

  /// Force le statut cotisation (admin). Conserve une trace ledger.
  Future<void> setMemberFeeStatus({
    required String clubId,
    required String seasonId,
    required String memberId,
    required MemberFeeStatus status,
  }) async {
    final uid = _paths.currentUid();
    if (uid == null) throw StateError('Non connecté');

    final feeRef = _paths.memberFeesCol(clubId, seasonId).doc(memberId);
    final existingSnap = await feeRef.get();
    final previousPaid = existingSnap.exists
        ? MemberFee.fromFirestore(memberId, existingSnap).amountPaidCents
        : 0;
    final previousStatus = existingSnap.exists
        ? MemberFee.fromFirestore(memberId, existingSnap).status
        : null;

    final data = <String, dynamic>{
      FirestoreFields.feeStatus: status.firestoreValue,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      FirestoreFields.markedBy: uid,
    };

    if (status == MemberFeeStatus.paye) {
      data[FirestoreFields.paidAt] = FieldValue.serverTimestamp();
      data[FirestoreFields.paidVia] = FeePaidVia.manual;
    } else {
      data[FirestoreFields.paidAt] = FieldValue.delete();
    }

    if (status == MemberFeeStatus.exonere) {
      data[FirestoreFields.tierId] = FieldValue.delete();
    }

    final batch = _paths.db.batch();
    batch.set(feeRef, data, SetOptions(merge: true));

    final eventType = status == MemberFeeStatus.exonere
        ? FeePaymentEventTypes.exempted
        : status == MemberFeeStatus.paye
            ? FeePaymentEventTypes.markedPaid
            : previousStatus == MemberFeeStatus.exonere
                ? FeePaymentEventTypes.unexempted
                : null;
    if (eventType != null) {
      _paths.appendPaymentEvent(
        batch: batch,
        clubId: clubId,
        seasonId: seasonId,
        memberId: memberId,
        payload: feePaymentEventPayload(
          type: eventType,
          deltaCents: 0,
          amountPaidCentsBefore: previousPaid,
          amountPaidCentsAfter: previousPaid,
          statusAfter: status.firestoreValue,
          actorUid: uid,
          paidVia: FeePaidVia.manual,
        ),
      );
    }

    await batch.commit();
  }

  /// Valide un paiement hors-ligne et l'ajoute au ledger de façon atomique.
  Future<void> validateOfflinePayment({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String offlineMethod,
    required int amountCents,
    required FeeSeason season,
    // ignore: avoid_unused_constructor_parameters, unused_element_parameter
    MemberFee? currentFee,
  }) async {
    final uid = _paths.currentUid();
    if (uid == null) throw StateError('Non connecté');
    if (amountCents < 0) throw ArgumentError('Montant invalide');
    if (!FeePaymentMethods.offline.contains(offlineMethod)) {
      throw ArgumentError('Moyen hors-ligne inconnu');
    }

    final feeRef = _paths.memberFeesCol(clubId, seasonId).doc(memberId);

    await _paths.db.runTransaction((tx) async {
      final snap = await tx.get(feeRef);
      if (!snap.exists) {
        throw StateError('Fiche cotisation introuvable');
      }
      final fee = MemberFee.fromFirestore(memberId, snap);

      final newPaid = fee.amountPaidCents + amountCents;
      final resolution = resolveMemberFeePaymentStatus(
        isExempt: fee.status == MemberFeeStatus.exonere,
        dueCents: fee.amountDueCents(season),
        amountPaidCents: newPaid,
        validatedAidsCents: fee.validatedAidsCents,
        hasPendingAids: fee.aids.any((aid) => aid.isPendingProof),
      );

      tx.set(
        feeRef,
        {
          FirestoreFields.amountPaidCents: newPaid,
          FirestoreFields.offlineMethod: offlineMethod,
          FirestoreFields.paidVia: FeePaidVia.offline,
          FirestoreFields.feeStatus: resolution.statusValue,
          if (resolution.isFullyPaid)
            FirestoreFields.paidAt: FieldValue.serverTimestamp(),
          if (resolution.clearPaidAt)
            FirestoreFields.paidAt: FieldValue.delete(),
          FirestoreFields.markedBy: uid,
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );

      if (amountCents > 0) {
        _paths.appendPaymentEventInTransaction(
          tx: tx,
          clubId: clubId,
          seasonId: seasonId,
          memberId: memberId,
          payload: feePaymentEventPayload(
            type: FeePaymentEventTypes.offlineCredit,
            deltaCents: amountCents,
            amountPaidCentsBefore: fee.amountPaidCents,
            amountPaidCentsAfter: newPaid,
            statusAfter: resolution.statusValue,
            actorUid: uid,
            offlineMethod: offlineMethod,
            paidVia: FeePaidVia.offline,
          ),
        );
      }
    });
  }

  /// Pose le montant déjà encaissé (absolu) et recalcule le statut.
  Future<void> adjustMemberFeePaidAmount({
    required String clubId,
    required String seasonId,
    required String memberId,
    required int amountPaidCents,
    required FeeSeason season,
    String? note,
    MemberFee? currentFee,
  }) async {
    final uid = _paths.currentUid();
    if (uid == null) throw StateError('Non connecté');
    if (amountPaidCents < 0) throw ArgumentError('Montant invalide');

    final feeRef = _paths.memberFeesCol(clubId, seasonId).doc(memberId);
    final fee = currentFee ??
        await feeRef.get().then(
          (snap) =>
              snap.exists ? MemberFee.fromFirestore(memberId, snap) : null,
        );
    if (fee == null) throw StateError('Fiche cotisation introuvable');
    if (fee.status == MemberFeeStatus.exonere) {
      throw StateError('Membre exonere - ajustement impossible');
    }
    if (fee.tierId == null || fee.tierId!.isEmpty) {
      throw StateError('Aucune cotisation assignee pour ce membre');
    }

    final resolution = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: fee.amountDueCents(season),
      amountPaidCents: amountPaidCents,
      validatedAidsCents: fee.validatedAidsCents,
      hasPendingAids: fee.aids.any((aid) => aid.isPendingProof),
    );

    final data = <String, dynamic>{
      FirestoreFields.amountPaidCents: amountPaidCents,
      FirestoreFields.feeStatus: resolution.statusValue,
      FirestoreFields.markedBy: uid,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      if (resolution.isFullyPaid)
        FirestoreFields.paidAt: FieldValue.serverTimestamp(),
      if (resolution.clearPaidAt) FirestoreFields.paidAt: FieldValue.delete(),
    };

    if (amountPaidCents == 0) {
      data[FirestoreFields.paidVia] = FieldValue.delete();
      data[FirestoreFields.offlineMethod] = FieldValue.delete();
      data[FirestoreFields.paymentProvider] = FieldValue.delete();
    } else if (amountPaidCents != fee.amountPaidCents) {
      data[FirestoreFields.paidVia] = FeePaidVia.manual;
      data[FirestoreFields.offlineMethod] = FieldValue.delete();
      data[FirestoreFields.paymentProvider] = FieldValue.delete();
    }

    final trimmedNote = note?.trim();
    if (trimmedNote != null && trimmedNote.isNotEmpty) {
      final previous = (fee.notesAdmin ?? '').trim();
      data[FirestoreFields.notesAdmin] = previous.isEmpty
          ? trimmedNote
          : '$previous\n$trimmedNote';
    }

    final batch = _paths.db.batch();
    batch.set(feeRef, data, SetOptions(merge: true));

    if (amountPaidCents != fee.amountPaidCents) {
      _paths.appendPaymentEvent(
        batch: batch,
        clubId: clubId,
        seasonId: seasonId,
        memberId: memberId,
        payload: feePaymentEventPayload(
          type: FeePaymentEventTypes.adjustAbsolute,
          deltaCents: amountPaidCents - fee.amountPaidCents,
          amountPaidCentsBefore: fee.amountPaidCents,
          amountPaidCentsAfter: amountPaidCents,
          statusAfter: resolution.statusValue,
          actorUid: uid,
          paidVia: amountPaidCents == 0 ? null : FeePaidVia.manual,
          note: trimmedNote,
        ),
      );
    }

    await batch.commit();
  }

  /// Valide ou refuse un justificatif d'aide (Pass'Sport, ANCV, etc.).
  Future<void> setFeeAidStatus({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String aidId,
    required String aidStatus,
    required FeeSeason season,
    MemberFee? currentFee,
  }) async {
    final uid = _paths.currentUid();
    if (uid == null) throw StateError('Non connecté');
    if (aidStatus != FeeAidStatuses.validated &&
        aidStatus != FeeAidStatuses.rejected) {
      throw ArgumentError('Statut aide invalide');
    }

    final feeRef = _paths.memberFeesCol(clubId, seasonId).doc(memberId);
    final fee = currentFee ??
        await feeRef.get().then(
          (snap) =>
              snap.exists ? MemberFee.fromFirestore(memberId, snap) : null,
        );
    if (fee == null) throw StateError('Fiche cotisation introuvable');

    final now = DateTime.now();
    FeeAid? touchedAid;
    final updatedAids = fee.aids.map((aid) {
      if (aid.id != aidId) return aid;
      touchedAid = aid;
      return aid.copyWithValidation(
        status: aidStatus,
        validatedBy: uid,
        validatedAt: now,
      );
    }).toList();

    final validatedAids = updatedAids
        .where((aid) => aid.isValidated)
        .fold<int>(0, (total, aid) => total + aid.amountCents);
    final hasPendingAids = updatedAids.any((aid) => aid.isPendingProof);
    final resolution = resolveMemberFeePaymentStatus(
      isExempt: fee.status == MemberFeeStatus.exonere,
      dueCents: fee.amountDueCents(season),
      amountPaidCents: fee.amountPaidCents,
      validatedAidsCents: validatedAids,
      hasPendingAids: hasPendingAids,
    );

    final batch = _paths.db.batch();
    batch.set(
      feeRef,
      {
        FirestoreFields.aids: updatedAids.map((aid) => aid.toMap()).toList(),
        FirestoreFields.feeStatus: resolution.statusValue,
        if (resolution.isFullyPaid)
          FirestoreFields.paidAt: FieldValue.serverTimestamp(),
        if (resolution.clearPaidAt)
          FirestoreFields.paidAt: FieldValue.delete(),
        FirestoreFields.markedBy: uid,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );

    final aid = touchedAid;
    if (aid != null) {
      _paths.appendPaymentEvent(
        batch: batch,
        clubId: clubId,
        seasonId: seasonId,
        memberId: memberId,
        payload: feePaymentEventPayload(
          type: aidStatus == FeeAidStatuses.validated
              ? FeePaymentEventTypes.aidValidated
              : FeePaymentEventTypes.aidRejected,
          deltaCents: 0,
          amountPaidCentsBefore: fee.amountPaidCents,
          amountPaidCentsAfter: fee.amountPaidCents,
          statusAfter: resolution.statusValue,
          actorUid: uid,
          aidId: aid.id,
          aidLabel: aid.label,
          aidAmountCents: aid.amountCents,
        ),
      );
    }

    await batch.commit();
  }

  /// Assigne un palier et recalcule le statut selon le déjà payé.
  Future<void> setMemberFeeTier({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String? tierId,
    required FeeSeason season,
    MemberFee? currentFee,
  }) async {
    final uid = _paths.currentUid();
    if (uid == null) throw StateError('Non connecté');

    final feeRef = _paths.memberFeesCol(clubId, seasonId).doc(memberId);
    final fee = currentFee ??
        await feeRef.get().then(
          (snap) =>
              snap.exists ? MemberFee.fromFirestore(memberId, snap) : null,
        );

    final data = <String, dynamic>{
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      FirestoreFields.markedBy: uid,
    };

    String? statusAfter;
    final wasExempt = fee?.status == MemberFeeStatus.exonere;

    if (tierId != null && tierId.isNotEmpty) {
      data[FirestoreFields.tierId] = tierId;
      final resolution = resolveMemberFeePaymentStatus(
        isExempt: false,
        dueCents: amountDueCentsForTier(
          season: season,
          tierId: tierId,
          isExempt: false,
        ),
        amountPaidCents: fee?.amountPaidCents ?? 0,
        validatedAidsCents: fee?.validatedAidsCents ?? 0,
        hasPendingAids: fee?.aids.any((aid) => aid.isPendingProof) ?? false,
      );
      data[FirestoreFields.feeStatus] = resolution.statusValue;
      statusAfter = resolution.statusValue;
      if (resolution.isFullyPaid) {
        data[FirestoreFields.paidAt] = FieldValue.serverTimestamp();
      }
      if (resolution.clearPaidAt) {
        data[FirestoreFields.paidAt] = FieldValue.delete();
      }
    } else {
      data[FirestoreFields.tierId] = FieldValue.delete();
    }

    final batch = _paths.db.batch();
    batch.set(feeRef, data, SetOptions(merge: true));

    if (wasExempt && tierId != null && tierId.isNotEmpty && statusAfter != null) {
      _paths.appendPaymentEvent(
        batch: batch,
        clubId: clubId,
        seasonId: seasonId,
        memberId: memberId,
        payload: feePaymentEventPayload(
          type: FeePaymentEventTypes.unexempted,
          deltaCents: 0,
          amountPaidCentsBefore: fee?.amountPaidCents ?? 0,
          amountPaidCentsAfter: fee?.amountPaidCents ?? 0,
          statusAfter: statusAfter,
          actorUid: uid,
        ),
      );
    }

    await batch.commit();
  }

  /// Met à jour la note admin de la fiche cotisation.
  Future<void> setMemberFeeNote({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String? note,
  }) async {
    final data = <String, dynamic>{
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    };
    if (note != null && note.trim().isNotEmpty) {
      data[FirestoreFields.notesAdmin] = note.trim();
    } else {
      data[FirestoreFields.notesAdmin] = FieldValue.delete();
    }
    await _paths
        .memberFeesCol(clubId, seasonId)
        .doc(memberId)
        .set(data, SetOptions(merge: true));
  }

  /// Compte les fiches déjà assignées à un palier donné.
  Future<int> countMemberFeesWithTier({
    required String clubId,
    required String seasonId,
    required String tierId,
  }) async {
    final snap = await _paths
        .memberFeesCol(clubId, seasonId)
        .where(FirestoreFields.tierId, isEqualTo: tierId)
        .get();
    return snap.docs.length;
  }
}
