import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/announcements/utils/announcement_filter.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_payment_event.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/utils/member_fee_status.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Accès Firestore aux cotisations (saisons + suivi par membre).
class FeeService {
  FeeService({FirebaseFirestore? firestore})
      : _db = firestore ?? appFirestore;

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _feeSeasonsCol(String clubId) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.feeSeasonsSubcollection);

  DocumentReference<Map<String, dynamic>> _feeSeasonRef(
    String clubId,
    String seasonId,
  ) =>
      _feeSeasonsCol(clubId).doc(seasonId);

  CollectionReference<Map<String, dynamic>> _memberFeesCol(
    String clubId,
    String seasonId,
  ) =>
      _feeSeasonsCol(clubId)
          .doc(seasonId)
          .collection(ProjectConfig.memberFeesSubcollection);

  CollectionReference<Map<String, dynamic>> _paymentEventsCol(
    String clubId,
    String seasonId,
    String memberId,
  ) =>
      _memberFeesCol(clubId, seasonId)
          .doc(memberId)
          .collection(ProjectConfig.paymentEventsSubcollection);

  String? _currentUid() => FirebaseAuth.instance.currentUser?.uid;

  /// Ajoute une entrée immuable au ledger (même batch que la fiche).
  void _appendPaymentEvent({
    required WriteBatch batch,
    required String clubId,
    required String seasonId,
    required String memberId,
    required Map<String, dynamic> payload,
  }) {
    final eventRef = _paymentEventsCol(clubId, seasonId, memberId).doc();
    batch.set(eventRef, {
      ...payload,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
    });
  }

  // ─── Lecture ───────────────────────────────────────────────────────────────

  Stream<FeeSeason?> watchActiveSeason(String clubId) {
    return _feeSeasonsCol(clubId)
        .where(FirestoreFields.isActive, isEqualTo: true)
        .limit(1)
        .snapshots()
        .map((snap) {
      if (snap.docs.isEmpty) return null;
      return FeeSeason.fromFirestore(snap.docs.first);
    });
  }

  Stream<MemberFee?> watchMemberFee({
    required String clubId,
    required String seasonId,
    required String memberId,
  }) {
    return _memberFeesCol(clubId, seasonId)
        .doc(memberId)
        .snapshots()
        .map((snap) {
      if (!snap.exists) return null;
      return MemberFee.fromFirestore(memberId, snap);
    });
  }

  Stream<List<MemberFee>> watchAllMemberFees({
    required String clubId,
    required String seasonId,
  }) {
    return _memberFeesCol(clubId, seasonId).snapshots().map(
          (snap) => snap.docs
              .map((d) => MemberFee.fromFirestore(d.id, d))
              .toList(),
        );
  }

  /// Historique des transactions d'une fiche cotisation (plus récent d'abord).
  Stream<List<FeePaymentEvent>> watchPaymentEvents({
    required String clubId,
    required String seasonId,
    required String memberId,
  }) {
    return _paymentEventsCol(clubId, seasonId, memberId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => FeePaymentEvent.fromFirestore(doc.id, doc))
              .toList(),
        );
  }

  /// Charge l'historique des transactions (plus récent d'abord).
  Future<List<FeePaymentEvent>> listPaymentEvents({
    required String clubId,
    required String seasonId,
    required String memberId,
    int limit = 50,
  }) async {
    final snap = await _paymentEventsCol(clubId, seasonId, memberId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(limit)
        .get();
    return snap.docs
        .map((doc) => FeePaymentEvent.fromFirestore(doc.id, doc))
        .toList();
  }

  Stream<({MemberFee? fee, FeeSeason? season})> watchActiveMemberFee({
    required String clubId,
    required String memberId,
  }) {
    return watchActiveSeason(clubId).asyncExpand((season) {
      if (season == null) {
        return Stream.value((fee: null, season: null));
      }
      return watchMemberFee(
        clubId: clubId,
        seasonId: season.id,
        memberId: memberId,
      ).map((fee) => (fee: fee, season: season));
    });
  }

  // ─── Saisons (admin) ───────────────────────────────────────────────────────

  Future<String> createSeason({
    required String clubId,
    required FeeSeason season,
  }) async {
    final uid = _currentUid();
    if (uid == null) throw StateError('Non connecté');

    final col = _feeSeasonsCol(clubId);
    final newRef = col.doc();
    final data = season.toFirestoreCreate();

    if (season.isActive) {
      final existingActive =
          await col.where(FirestoreFields.isActive, isEqualTo: true).get();
      if (existingActive.docs.isNotEmpty) {
        final batch = _db.batch();
        for (final doc in existingActive.docs) {
          batch.update(doc.reference, {FirestoreFields.isActive: false});
        }
        batch.set(newRef, data);
        await batch.commit();
        return newRef.id;
      }
    }

    await newRef.set(data);
    return newRef.id;
  }

  Future<void> updateSeason({
    required String clubId,
    required FeeSeason season,
  }) async {
    await _feeSeasonRef(clubId, season.id).update(season.toFirestoreUpdate());
  }

  Future<void> closeSeason({
    required String clubId,
    required String seasonId,
  }) async {
    await _feeSeasonRef(clubId, seasonId).update({
      FirestoreFields.isActive: false,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // ─── Member fees (admin) ───────────────────────────────────────────────────

  /// Force le statut cotisation (admin). Conserve une trace ledger.
  Future<void> setMemberFeeStatus({
    required String clubId,
    required String seasonId,
    required String memberId,
    required MemberFeeStatus status,
  }) async {
    final uid = _currentUid();
    if (uid == null) throw StateError('Non connecté');

    final feeRef = _memberFeesCol(clubId, seasonId).doc(memberId);
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

    final batch = _db.batch();
    batch.set(feeRef, data, SetOptions(merge: true));

    final eventType = status == MemberFeeStatus.exonere
        ? FeePaymentEventTypes.exempted
        : status == MemberFeeStatus.paye
            ? FeePaymentEventTypes.markedPaid
            : previousStatus == MemberFeeStatus.exonere
                ? FeePaymentEventTypes.unexempted
                : null;
    if (eventType != null) {
      _appendPaymentEvent(
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

  /// Valide un paiement hors-ligne (chèque, espèces, ANCV, etc.).
  Future<void> validateOfflinePayment({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String offlineMethod,
    required int amountCents,
    required FeeSeason season,
    MemberFee? currentFee,
  }) async {
    final uid = _currentUid();
    if (uid == null) throw StateError('Non connecté');
    if (amountCents < 0) throw ArgumentError('Montant invalide');
    if (!FeePaymentMethods.offline.contains(offlineMethod)) {
      throw ArgumentError('Moyen hors-ligne inconnu');
    }

    final feeRef = _memberFeesCol(clubId, seasonId).doc(memberId);
    final fee = currentFee ??
        await feeRef.get().then(
              (snap) => snap.exists
                  ? MemberFee.fromFirestore(memberId, snap)
                  : null,
            );
    if (fee == null) throw StateError('Fiche cotisation introuvable');

    final newPaid = fee.amountPaidCents + amountCents;
    final resolution = resolveMemberFeePaymentStatus(
      isExempt: fee.status == MemberFeeStatus.exonere,
      dueCents: fee.amountDueCents(season),
      amountPaidCents: newPaid,
      validatedAidsCents: fee.validatedAidsCents,
      hasPendingAids: fee.aids.any((aid) => aid.isPendingProof),
    );

    final batch = _db.batch();
    batch.set(
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
      _appendPaymentEvent(
        batch: batch,
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

    await batch.commit();
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
    final uid = _currentUid();
    if (uid == null) throw StateError('Non connecté');
    if (amountPaidCents < 0) throw ArgumentError('Montant invalide');

    final feeRef = _memberFeesCol(clubId, seasonId).doc(memberId);
    final fee = currentFee ??
        await feeRef.get().then(
              (snap) => snap.exists
                  ? MemberFee.fromFirestore(memberId, snap)
                  : null,
            );
    if (fee == null) throw StateError('Fiche cotisation introuvable');
    if (fee.status == MemberFeeStatus.exonere) {
      throw StateError('Membre exonéré — ajustement impossible');
    }
    if (fee.tierId == null || fee.tierId!.isEmpty) {
      throw StateError('Aucune cotisation assignée pour ce membre');
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
      // Correction admin : canal manuel (ne pas laisser un vieux Stripe/offline).
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

    final batch = _db.batch();
    batch.set(feeRef, data, SetOptions(merge: true));

    if (amountPaidCents != fee.amountPaidCents) {
      _appendPaymentEvent(
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

  /// Valide ou refuse un justificatif d'aide (Pass'Sport, ANCV, …).
  Future<void> setFeeAidStatus({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String aidId,
    required String aidStatus,
    required FeeSeason season,
    MemberFee? currentFee,
  }) async {
    final uid = _currentUid();
    if (uid == null) throw StateError('Non connecté');
    if (aidStatus != FeeAidStatuses.validated &&
        aidStatus != FeeAidStatuses.rejected) {
      throw ArgumentError('Statut aide invalide');
    }

    final feeRef = _memberFeesCol(clubId, seasonId).doc(memberId);
    final fee = currentFee ??
        await feeRef.get().then(
              (snap) => snap.exists
                  ? MemberFee.fromFirestore(memberId, snap)
                  : null,
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
        .where((a) => a.isValidated)
        .fold<int>(0, (total, aid) => total + aid.amountCents);
    final hasPendingAids = updatedAids.any((a) => a.isPendingProof);
    final resolution = resolveMemberFeePaymentStatus(
      isExempt: fee.status == MemberFeeStatus.exonere,
      dueCents: fee.amountDueCents(season),
      amountPaidCents: fee.amountPaidCents,
      validatedAidsCents: validatedAids,
      hasPendingAids: hasPendingAids,
    );

    final batch = _db.batch();
    batch.set(
      feeRef,
      {
        FirestoreFields.aids: updatedAids.map((a) => a.toMap()).toList(),
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
      _appendPaymentEvent(
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
    final uid = _currentUid();
    if (uid == null) throw StateError('Non connecté');

    final feeRef = _memberFeesCol(clubId, seasonId).doc(memberId);
    final fee = currentFee ??
        await feeRef.get().then(
              (snap) => snap.exists
                  ? MemberFee.fromFirestore(memberId, snap)
                  : null,
            );

    final data = <String, dynamic>{
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      FirestoreFields.markedBy: uid,
    };

    String? statusAfter;
    final wasExempt = fee?.status == MemberFeeStatus.exonere;

    if (tierId != null && tierId.isNotEmpty) {
      data[FirestoreFields.tierId] = tierId;
      // Assigner un palier sort de l'exonération (aligné portal).
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

    final batch = _db.batch();
    batch.set(feeRef, data, SetOptions(merge: true));

    if (wasExempt && tierId != null && tierId.isNotEmpty && statusAfter != null) {
      _appendPaymentEvent(
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
    await _memberFeesCol(clubId, seasonId)
        .doc(memberId)
        .set(data, SetOptions(merge: true));
  }

  Future<int> countMemberFeesWithTier({
    required String clubId,
    required String seasonId,
    required String tierId,
  }) async {
    final snap = await _memberFeesCol(clubId, seasonId)
        .where(FirestoreFields.tierId, isEqualTo: tierId)
        .get();
    return snap.docs.length;
  }

  /// Crée les fiches manquantes pour membres + pending_members.
  Future<int> initializeMemberFees({
    required String clubId,
    required String seasonId,
    required List<ClubMember> members,
    required List<ClubTeam> teams,
    required List<ClubMember> pendingAsMembers,
    required Set<String> existingMemberIds,
    required List<FeeTier> tiers,
  }) async {
    final uid = _currentUid();
    if (uid == null) throw StateError('Non connecté');

    final toCreate = <ClubMember>[
      ...members,
      ...pendingAsMembers,
    ];

    final writes = <({String id, MemberFee fee})>[];
    for (final m in toCreate) {
      if (existingMemberIds.contains(m.memberId)) continue;
      final tierId = _suggestTierId(
        member: m,
        teams: teams,
        tiers: tiers,
      );
      writes.add((
        id: m.memberId,
        fee: MemberFee(
          memberId: m.memberId,
          memberDisplayName: m.fullName,
          status: MemberFeeStatus.aPayer,
          tierId: tierId,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        ),
      ));
    }

    if (writes.isEmpty) return 0;

    const maxBatch = 500;
    for (var i = 0; i < writes.length; i += maxBatch) {
      final batch = _db.batch();
      final end = (i + maxBatch > writes.length) ? writes.length : i + maxBatch;
      for (var j = i; j < end; j++) {
        final w = writes[j];
        final payload = w.fee.toFirestoreCreate(displayName: w.fee.memberDisplayName);
        if (w.fee.tierId != null) {
          payload[FirestoreFields.tierId] = w.fee.tierId;
        }
        batch.set(_memberFeesCol(clubId, seasonId).doc(w.id), payload);
      }
      await batch.commit();
    }
    return writes.length;
  }

  String? _suggestTierId({
    required ClubMember member,
    required List<ClubTeam> teams,
    required List<FeeTier> tiers,
  }) {
    if (tiers.isEmpty) return null;
    final categories = memberCategoriesFromTeams(
      clubTeams: teams,
      memberTeamIds: member.teamIds,
    );
    for (final cat in categories) {
      for (final tier in tiers) {
        final linked = tier.category;
        if (linked != null &&
            linked.isNotEmpty &&
            linked.toLowerCase() == cat.toLowerCase()) {
          return tier.tierId;
        }
      }
    }
    for (final cat in categories) {
      for (final tier in tiers) {
        if (tier.label.toLowerCase() == cat.toLowerCase()) {
          return tier.tierId;
        }
      }
    }
    return null;
  }

  Future<void> bulkSetStatus({
    required String clubId,
    required String seasonId,
    required List<String> memberIds,
    required MemberFeeStatus status,
  }) async {
    const maxBatch = 500;
    for (var i = 0; i < memberIds.length; i += maxBatch) {
      final end =
          (i + maxBatch > memberIds.length) ? memberIds.length : i + maxBatch;
      await Future.wait(
        memberIds.sublist(i, end).map(
              (id) => setMemberFeeStatus(
                clubId: clubId,
                seasonId: seasonId,
                memberId: id,
                status: status,
              ),
            ),
      );
    }
  }

  Future<void> bulkSetTier({
    required String clubId,
    required String seasonId,
    required List<String> memberIds,
    required String tierId,
    required FeeSeason season,
  }) async {
    const maxBatch = 500;
    for (var i = 0; i < memberIds.length; i += maxBatch) {
      final end =
          (i + maxBatch > memberIds.length) ? memberIds.length : i + maxBatch;
      await Future.wait(
        memberIds.sublist(i, end).map(
              (id) => setMemberFeeTier(
                clubId: clubId,
                seasonId: seasonId,
                memberId: id,
                tierId: tierId,
                season: season,
              ),
            ),
      );
    }
  }

  /// Export CSV pour le trésorier.
  Future<String> exportCsv({
    required String clubId,
    required String seasonId,
    required FeeSeason season,
    required List<MemberFee> fees,
  }) async {
    final buffer = StringBuffer();
    buffer.writeln('Nom;Catégorie;Montant;Statut;Date paiement;Notes admin');

    for (final fee in fees) {
      final tier = season.tierById(fee.tierId);
      final tierLabel = tier?.label ?? 'Non assigné';
      final amount = fee.status == MemberFeeStatus.exonere
          ? '0,00 €'
          : formatFeeAmountCents(fee.amountDueCents(season));
      final display = fee.displayStatus(season.paymentDeadlineAt);
      final statusLabel = display.label;
      final paidAt = fee.paidAt != null
          ? '${fee.paidAt!.day.toString().padLeft(2, '0')}/'
              '${fee.paidAt!.month.toString().padLeft(2, '0')}/'
              '${fee.paidAt!.year}'
          : '';
      final notes = (fee.notesAdmin ?? '').replaceAll(';', ',');
      buffer.writeln(
        '${fee.memberDisplayName};$tierLabel;$amount;$statusLabel;$paidAt;$notes',
      );
    }
    return buffer.toString();
  }
}
