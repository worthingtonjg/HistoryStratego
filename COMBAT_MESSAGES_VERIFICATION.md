# Combat preset messages

Players may send validated friendly presets during a combat cutscene, including the final combat, regardless of whose turn it is. The 10-second per-player cooldown, teacher pause/class-end restrictions, membership checks and read-only spectator behavior remain. Message handling does not tick or mutate the match.

The choices have an explicit opaque dark background with reset GUI tint. Pointer and wheel events inside the popup are withheld from the underlying sidebar. Combat acknowledgment remains confined to the board.

Verified: 220 automated tests passed; Unity WebGL CombatMessagesRelease succeeded. One actual Unity local fixture opened the menu during combat, scrolled over it and sent a message. Exactly one emote and zero acknowledgments were recorded; turn and sequence stayed unchanged, and cooldown remained 10000 ms. Inspected screenshots show readable opaque choices, unchanged instructions scroll position, and the sender notification above the battle. No live Playroom clients or existing user classrooms were used.