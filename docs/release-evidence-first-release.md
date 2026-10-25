# First-release predecessor disposition

An upgrade cannot be tested when no predecessor has ever been deployed. The release
evidence gate permits `not-applicable` only for `actual-predecessor-upgrade`, with a
candidate-bound human release-owner attestation. This disposition records an
unperformed upgrade; it does not report an upgrade pass or waive any other case.

Set `predecessor.kind` to `none-deployed` and provide `predecessor.attestation`:

| Field                   | Required value                                                                    |
| ----------------------- | --------------------------------------------------------------------------------- |
| `source`                | `human-release-owner`                                                             |
| `releaseOwner`          | Exact name recorded in `handoff.releaseOwner`                                     |
| `date`                  | Date of the owner's attestation                                                   |
| `noDeployedPredecessor` | Boolean `true`                                                                    |
| `statement`             | Explicit statement that this is the first release and no predecessor was deployed |
| `artifact`              | Existing local record of that human attestation                                   |

The case retains its exact `candidateSha256`, `date`, `procedure`, `expected`,
`actual` and `artifacts`; `tester` must equal the attesting release owner and
`artifacts` must include the attestation artifact. Hardware, fixtures and measured
upgrade checks are unnecessary because no upgrade took place. Remove deployed
inventory fields (`version`, `installerSha256`, `registration`, `inventoryArtifact`)
from the `none-deployed` record; contradictory inventory is rejected.

An actual deployed predecessor still requires the existing `actual-installed`
inventory, older version, installer hash, registration, inventory artifact and
passing installed-upgrade evidence. A generated test installation cannot replace
that history. All remaining required cases, named edge reviews and protected
handoff/signing decisions remain subject to their existing checks.
