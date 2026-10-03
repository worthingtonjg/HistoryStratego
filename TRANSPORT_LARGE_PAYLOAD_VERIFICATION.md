# Large encrypted transport payload fix

## Root cause and change

Base64 encoding previously expanded the entire encrypted payload into function arguments for String.fromCharCode. Once a classroom checkpoint/response grew sufficiently large, this exceeded the JavaScript engine's argument/stack limit and threw RangeError. Match events and retained request receipts grow with play; refreshing does not fix the old encoder because connection/recovery writes another checkpoint from saved state.

The encoder now uses bounded 8192-byte chunks, then Base64-encodes the combined binary string. AES-GCM, nonces, keys, packet format, redaction, stored checkpoint identity and recovery semantics are unchanged. No state/history truncation, reset, or storage deletion.

## Verified

17 transport/security tests pass, including recipient-key rejection, tamper rejection, remote teacher-control rejection, student redaction, retirement, seat reuse and checkpoint recovery. New round trips cover chunk boundaries, Unicode, 128 KiB, 1 MiB and 5 MiB payloads. Canonical Base64 is checked against Node's independent implementation.

Real Chrome reproduces the old overflow with both a 1 MiB byte array and an actual generated 1200-move classroom checkpoint. The fixed encoder saves a roughly 358 KB encrypted checkpoint, recovers all 1200 events and the same student identity in paused state, and permits an authorized fixture move to sequence 1201 after Resume. No browser exceptions. Evidence: Logs/transport-large-tests.log and Logs/transport-large-browser-result.json.

All tests use local fixtures/fake SDK, with no fresh Playroom identities or user match access. This is a JavaScript-only fix; the verified Unity WebGL binaries are unchanged.

## Supported recovery advice

After the deployed fix is verified, reload the teacher page in the same browser profile and unlock it with the existing teacher key. The existing current-class pointer causes recovery of the encrypted checkpoint, rather than creation of a new class. Recovery pauses an active class. Confirm the restored board before choosing Resume. Keep existing browser storage; do not use New class or clear site data as a recovery step.

The user's actual checkpoint has not been inspected. A failed seal occurs before localStorage.setItem, leaving the prior successful checkpoint intact, but moves after that successful save may not be recoverable. Fixture recovery success is not a guarantee that every unsaved live move can be restored.
