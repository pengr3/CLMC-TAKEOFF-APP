# CLMC Takeoff 1.1.1 — release notice supplement

Prepared 26 October 2026 (Asia/Manila) for Francis's review of the unsigned internal
release. **Approval of this supplement remains pending.** Keep this companion with
the approved installer and its hash manifest if the release owner accepts it.

## Exact candidate

| Artifact                           | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `clmc-takeoff-1.1.1-x64-setup.exe` | `f136edee86aeec196848a5773af4f090e7f452c6aed26f56bdbaf5ed3c1c0f8e` |
| Bundled `app.asar`                 | `b2c338423e5edff1daab0d32bb74ae1a97edbabce1137453cf2ad153921e8c98` |

This external supplement preserves those tested bytes. The current installer's
embedded dependency notices do **not** contain the later declaration documented
below. The published and packaged `buffers@0.1.1` metadata has no license field;
the generated notices truthfully retain `license: null` for that metadata.

## buffers 0.1.1 attribution and upstream declaration

The runtime dependency chain is `exceljs@4.4.0 → unzipper@0.10.14 → binary@0.3.0 →
buffers@0.1.1`. Its author is James Halliday. The [published npm metadata](https://registry.npmjs.org/buffers/0.1.1)
and [0.1.1 tarball](https://registry.npmjs.org/buffers/-/buffers-0.1.1.tgz) omit a
license declaration.

The original release commit
[`51ac8d0324008b0d0ed5759b1466402a77ff8dc8`](https://github.com/bitpay/node-buffers/commit/51ac8d0324008b0d0ed5759b1466402a77ff8dc8)
is preserved in the BitPay fork of the original repository. Its immediate child,
[`1b745ee35d33eb166e15ef1866073a07c6d7de87`](https://github.com/bitpay/node-buffers/commit/1b745ee35d33eb166e15ef1866073a07c6d7de87),
was authored and committed by James Halliday on 3 April 2012 and adds the explicit
identifier **MIT/X11**. That commit changes only the [README license section](https://raw.githubusercontent.com/bitpay/node-buffers/1b745ee35d33eb166e15ef1866073a07c6d7de87/README.markdown)
and [package license field](https://raw.githubusercontent.com/bitpay/node-buffers/1b745ee35d33eb166e15ef1866073a07c6d7de87/package.json).

The 7,057-byte `buffers/index.js` is byte-identical in the published tarball,
installed dependency, candidate ASAR, original release commit and subsequent
license commit. Its SHA-256 is
`97801e296ba5f3c32242f647e1daac5917e300367fed7935ab1e62f40adb1b8a`.
The tarball SHA-256 is
`f8de49c60e467005182d9687b5d87775bbcec6385ac63220b7741327441deb6d`;
its SHA-512 integrity also matches the lockfile. Packaged `package.json` was
reserialized with scripts removed by electron-builder; all remaining fields match
the published package. This finding concerns the same runtime code, rather than
a different npm package or a modified current fork.

## Release-owner review

The author commit supplies the historical identifier `MIT/X11`; it supplies no
complete permission/warranty text or separate copyright-year notice. This
supplement records that declaration and provenance without inventing an upstream
license file or claiming legal clearance. Francis's unsigned internal-use
decision does not itself approve this dependency disposition.

The concrete decision is whether to accept this accompanying attribution and
provenance supplement for the identified internal release, or require further
license clarification/review before approval. Record the owner's name, date and
disposition with the release record. An accompanying supplement can preserve the
candidate bytes; editing embedded notices instead produces a different candidate
requiring renewed build/hash validation.

The existing 22 October dependency/advisory review remains separate. This
supplement changes no dependency, package metadata or runtime code and does not
close unrelated release checks. Supporting byte comparisons are recorded in
`license-research/verified-provenance.json` in the internal Phase 20 test evidence.
