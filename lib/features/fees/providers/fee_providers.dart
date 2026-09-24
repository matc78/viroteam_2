import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/fees/models/fee_payment_event.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

/// Rappel cotisation affiché sur la home.
class HomeFeeReminderItem {
  const HomeFeeReminderItem({
    required this.clubId,
    required this.clubName,
    required this.brandColorHex,
    required this.season,
    required this.fee,
    this.childFirstName,
  });

  final String clubId;
  final String clubName;
  final String? brandColorHex;
  final FeeSeason season;
  final MemberFee fee;

  /// Prénom de l’enfant si le rappel concerne une fiche parentée.
  final String? childFirstName;

  bool get isOverdue =>
      fee.displayStatus(season.paymentDeadlineAt) ==
      MemberFeeDisplayStatus.enRetard;

  bool get isDeadlineToday {
    final deadline = season.paymentDeadlineAt;
    if (deadline == null) return false;
    return MemberFee.isDeadlineToday(deadline);
  }

  /// Jour J avec cotisation encore due — fond rouge global.
  bool get isFeeDeadlineUrgentDay {
    if (!isDeadlineToday) return false;
    if (fee.status == MemberFeeStatus.paye ||
        fee.status == MemberFeeStatus.exonere) {
      return false;
    }
    return fee.remainingCents(season) > 0;
  }

  bool get isUrgent => isOverdue || isFeeDeadlineUrgentDay;
}

final activeSeasonProvider =
    StreamProvider.family<FeeSeason?, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value(null);
  return ref.read(feeServiceProvider).watchActiveSeason(clubId);
});

final myFeeProvider = StreamProvider.family<
    ({MemberFee? fee, FeeSeason? season}),
    ({String clubId, String memberId})>((ref, params) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) {
    return Stream.value((fee: null, season: null));
  }
  return ref.read(feeServiceProvider).watchActiveMemberFee(
        clubId: params.clubId,
        memberId: params.memberId,
      );
});

final allMemberFeesProvider =
    StreamProvider.family<List<MemberFee>, String>((ref, clubId) {
  final season = ref.watch(activeSeasonProvider(clubId)).value;
  if (season == null) return Stream.value([]);
  return ref.read(feeServiceProvider).watchAllMemberFees(
        clubId: clubId,
        seasonId: season.id,
      );
});

/// Historique ledger d'une fiche cotisation.
final memberFeePaymentEventsProvider = StreamProvider.family<
    List<FeePaymentEvent>,
    ({String clubId, String seasonId, String memberId})>((ref, params) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value(const []);
  return ref.read(feeServiceProvider).watchPaymentEvents(
        clubId: params.clubId,
        seasonId: params.seasonId,
        memberId: params.memberId,
      );
});

final feeStatsProvider = Provider.family<FeeStats, String>((ref, clubId) {
  final fees = ref.watch(allMemberFeesProvider(clubId)).value ?? [];
  final season = ref.watch(activeSeasonProvider(clubId)).value;
  return FeeStats.compute(fees, season?.paymentDeadlineAt);
});

/// Bannières cotisation due sur la home (tous clubs).
final homeFeeRemindersProvider =
    StreamProvider<List<HomeFeeReminderItem>>((ref) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  final clubs = ref.watch(userClubsProvider).value;

  if (auth == null || clubs == null || clubs.isEmpty) {
    return Stream.value([]);
  }

  final authUid = auth.uid;
  final feeService = ref.read(feeServiceProvider);
  final eventService = ref.read(eventServiceProvider);

  final streams = clubs.map<Stream<List<HomeFeeReminderItem>>>((entry) {
    final club = entry.club;
    final clubStreams = <Stream<List<HomeFeeReminderItem>>>[];

    // Cotisations des enfants suivis — prénom depuis la fiche fee, sinon lecture membre.
    if (entry.hasFamilyLinks) {
      final guardianService = ref.read(guardianServiceProvider);
      for (final link in entry.parentLinks) {
        clubStreams.add(
          feeService
              .watchActiveMemberFee(
                clubId: club.id,
                memberId: link.memberId,
              )
              .asyncMap((data) async {
                var childName = _firstNameFromDisplayName(
                  data.fee?.memberDisplayName,
                );
                if (childName == null) {
                  try {
                    childName = await guardianService.childFirstName(
                      clubId: club.id,
                      memberId: link.memberId,
                    );
                  } catch (_) {
                    childName = null;
                  }
                }
                return _reminderFromFee(
                  club: club,
                  data: data,
                  childFirstName: childName,
                );
              }),
        );
      }
    }

    // Cotisation de sa propre fiche (licencié), hors enfants déjà listés.
    if (entry.isLicensed) {
      final childMemberIds = {
        for (final link in entry.parentLinks) link.memberId,
      };
      clubStreams.add(
        eventService
            .watchClubMember(clubId: club.id, uid: authUid)
            .asyncExpand((member) {
          if (member == null) {
            return Stream.value(<HomeFeeReminderItem>[]);
          }
          if (childMemberIds.contains(member.memberId)) {
            return Stream.value(<HomeFeeReminderItem>[]);
          }
          return feeService
              .watchActiveMemberFee(
                clubId: club.id,
                memberId: member.memberId,
              )
              .map((data) => _reminderFromFee(club: club, data: data));
        }),
      );
    }

    if (clubStreams.isEmpty) {
      return Stream.value(<HomeFeeReminderItem>[]);
    }
    if (clubStreams.length == 1) return clubStreams.first;
    return combineLatestListStreams<HomeFeeReminderItem>(clubStreams);
  }).toList();

  return combineLatestListStreams<HomeFeeReminderItem>(streams).map(
    (items) => items.take(3).toList(),
  );
});

/// Fond rouge sur toute l'app si échéance cotisation aujourd'hui.
final feeDeadlineUrgentBackgroundProvider = Provider<bool>((ref) {
  final items = ref.watch(homeFeeRemindersProvider).value ?? [];
  return items.any((item) => item.isFeeDeadlineUrgentDay);
});

/// Premier prénom utilisable depuis un libellé membre (fiche cotisation).
String? _firstNameFromDisplayName(String? displayName) {
  final trimmed = displayName?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  return trimmed.split(' ').first;
}

List<HomeFeeReminderItem> _reminderFromFee({
  required Club club,
  required ({MemberFee? fee, FeeSeason? season}) data,
  String? childFirstName,
}) {
  final season = data.season;
  final fee = data.fee;
  if (season == null ||
      fee == null ||
      (fee.status != MemberFeeStatus.aPayer &&
          fee.status != MemberFeeStatus.partiel)) {
    return [];
  }
  if (fee.remainingCents(season) <= 0 && fee.pendingAidsCents <= 0) {
    return [];
  }
  final trimmedChildName = childFirstName?.trim();
  return [
    HomeFeeReminderItem(
      clubId: club.id,
      clubName: club.name,
      brandColorHex: club.brandColorHex,
      season: season,
      fee: fee,
      childFirstName: (trimmedChildName != null && trimmedChildName.isNotEmpty)
          ? trimmedChildName
          : null,
    ),
  ];
}
