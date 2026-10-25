# REL-02 technical edge review — first release

Reviewed **26 October 2026, Asia/Manila**, by **Codex, independent technical evidence reviewer**. This is a technical classification of the predecessor, identity, user-data and non-development-PC edge assumption. It is not human release approval, a waiver of another installed case, or Phase 20 acceptance.

**Disposition: reviewed for the first-release scope.** Francis explicitly confirmed that no deployed predecessor exists. The actual deployed-upgrade case is therefore **not applicable**, rather than passed. Actual second-PC fresh installation, stable identity, exact installed payload and profile preservation have separate evidence. This resolves the formerly unclassified REL-02 edge assumption without creating a fictional predecessor or accepting the remaining release matrix.

## Candidate and direct human source

This review applies only to **CLMC Takeoff 1.1.1**, Windows x64:

- Installer SHA-256: `f136edee86aeec196848a5773af4f090e7f452c6aed26f56bdbaf5ed3c1c0f8e`.
- ASAR SHA-256: `b2c338423e5edff1daab0d32bb74ae1a97edbabce1137453cf2ad153921e8c98`.

Francis's direct reply in this chat identified him as release owner and stated: **“This then first release.”** The adjacent answers selected unsigned internal use and confirmed the second monitor. The [release-owner record](C:/Users/franc/dev/CLMC-TAKEOFF-APP/.planning/phases/20-production-readiness/20-RELEASE-OWNER.md) preserves the exact wording and candidate binding. Its predecessor interpretation comes from that human statement, not an agent's inability to locate an installer or registration.

The test-installed 1.1.0 was disposable software used during this investigation. Its 1.1.0 → 1.1.1 transition remains a **synthetic test-install exercise**. It is not an actual deployed predecessor, and this review does not relabel it.

## Evidence reviewed

| Question | Observed evidence and technical conclusion |
| --- | --- |
| Is this an actual different PC? | The user confirmed LAPTOP-5BAM24NM is a different PC from the development machine. The record identifies Windows 11 Home Single Language build 22631, x64, 15.8 GiB. The installed tests were driven on that PC, independently of the original Lenovo development host. Rebuilding the candidate locally does not turn these actual installer/UI observations into development-host smoke. |
| Was the candidate freshly installed? | [Clean-install precondition](C:/Users/franc/dev/CLMC-TAKEOFF-APP/.planning/tmp/20-completion-20261026/clean-install-precondition.json) records zero CLMC registrations, no executable and no active profile before installation. This state was obtained by removing only the disposable test installation and preserving the existing profile separately. It does not claim that the PC had never previously run test software. |
| Does installed identity match the candidate? | [Fresh-install result](C:/Users/franc/dev/CLMC-TAKEOFF-APP/.planning/tmp/20-completion-20261026/fresh-install.json) records installer exit 0, all **149 payload hashes** matching, one CLMC Takeoff **1.1.1** registration, one Desktop shortcut and one Start-menu shortcut. Its installer/ASAR hashes match this review. Native captures 059–062 show the fresh launch and local About/notes version. |
| Did the uninstall/install exercise preserve the existing profile? | Before removal, **3,191 files** were inventoried with hashes. The precondition records all preserved files verified after the disposable uninstall. The [restoration result](C:/Users/franc/dev/CLMC-TAKEOFF-APP/.planning/tmp/20-completion-20261026/profile-restoration.json) records the original profile restored with **all 3,191 hashes unchanged**, the disposable profile preserved separately, and the candidate ASAR unchanged. No profile was deleted. This is actual preservation evidence from the fresh-install cycle, not a prediction based on installer configuration. |
| What about the local library? | The original profile's library was absent both before and after this cycle. No populated real-library upgrade pass is claimed. Separate seeded-library identity integration tests and actual disposable-library import/application tests cover their narrower contracts. With no deployed predecessor, there is no deployed library/version transition to invent. |
| Are projects dependent on the source PDF/library? | The current project-only-transfer case has a separate reviewed native pass. A sole transferred two-page format-3 archive opened without external PDF or local library, and its native saved copy retained exact PDF, mixed scales, all five markup types, arcs/wall heights, ordering/visibility and reviewed rates. This supports project portability; it does not substitute for an upgrade test. |

The original-profile restoration above was completed at `2026-10-25T17:23:14.9660021Z` (**26 October, 01:23 Manila**). Later display testing uses another isolated disposable-profile session. This dated evidence is not a claim that the later session has already been cleaned up; its final restoration remains the executing agent's required cleanup before handoff.

## Source and runtime/package cross-check

[app-identity.ts](C:/Users/franc/dev/CLMC-TAKEOFF-APP/src/main/app-identity.ts) sets `com.clmc.takeoff`, `CLMC Takeoff` and the existing `clmc-takeoff` storage directory. `pinUserData` runs before readiness in main; it does not migrate, merge or delete another legacy directory. [electron-builder.yml](C:/Users/franc/dev/CLMC-TAKEOFF-APP/electron-builder.yml) uses the same app identity, executable slug and visible name, per-user full NSIS, no elevation requirement and `deleteAppDataOnUninstall: false`. The source configuration agrees with the actual inventory above.

[identity-storage.test.ts](C:/Users/franc/dev/CLMC-TAKEOFF-APP/src/tests/identity-storage.test.ts) exercises early pinning and unchanged seeded library/preferences. The [dated dependency review](C:/Users/franc/dev/CLMC-TAKEOFF-APP/.planning/phases/20-production-readiness/20-DEPENDENCY-REVIEW.md), [Plan 05 summary](C:/Users/franc/dev/CLMC-TAKEOFF-APP/.planning/phases/20-production-readiness/20-05-SUMMARY.md) and [1.1.1 rebuild report](C:/Users/franc/dev/CLMC-TAKEOFF-APP/.planning/phases/20-production-readiness/20-REBUILD-RETEST.md) identify the explicitly approved Electron 44.9.3, reviewed yauzl 3.4.0, targeted tar remediation, retained advisory dispositions, actual sandboxed runtime smoke and inspected production package. Their host/test/lint qualifications remain intact. This review does not turn the remaining advisory or dependency-license/distribution decisions into human approval.

## Why the first-release exception is narrow

The [first-release evidence contract](C:/Users/franc/dev/CLMC-TAKEOFF-APP/docs/release-evidence-first-release.md) and [validator](C:/Users/franc/dev/CLMC-TAKEOFF-APP/scripts/verify-release-evidence.cjs) permit `not-applicable` **only** for `actual-predecessor-upgrade`. They require all of the following:

1. `predecessor.kind = none-deployed`, with no contradictory deployed version, installer hash, registration or inventory fields.
2. A `human-release-owner` attestation naming the same owner as handoff, dated, explicitly affirming no deployed predecessor and linked to an existing local artifact.
3. The case's tester equals that owner; exact candidate, provenance and attestation artifact remain recorded.

The [negative tests](C:/Users/franc/dev/CLMC-TAKEOFF-APP/src/tests/release-evidence.test.ts) reject incomplete/non-human/mismatched/contradictory attestations, applying not-applicable to unrelated cases, and treating a first release as a passed upgrade. The actual-installed branch still requires a genuine older predecessor and passing installed-upgrade evidence. No validator threshold or other case is waived by this review.

The older plan/validation prose requiring an actual predecessor when available is read with this explicit first-release disposition. If Francis's deployment-history statement later proves incomplete, this disposition must be withdrawn: inventory the actual predecessor and execute the genuine upgrade case. Preserve the distinction rather than retaining an inapplicable exemption.

## Limits and remaining ownership

This technical review may be recorded as the named **REL-02 edge review** with the first-release qualification above. It does not itself update canonical evidence, requirement checkboxes, global counts or release status.

Final profile restoration for the ongoing test session, all other installed-case evidence, protected handoff, dependency/license/stability decisions, human release approval and Phase 21 pilot/distribution remain separate obligations. No actual deployed upgrade occurred or passed. No person other than Francis is presented as the human release owner.
