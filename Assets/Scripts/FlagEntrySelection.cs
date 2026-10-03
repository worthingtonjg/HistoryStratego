using System;
using System.Collections.Generic;
// One local selection per Place Flag entry; never changes the authoritative formation.
public sealed class FlagEntrySelection
{
    readonly HashSet<string> entered = new HashSet<string>();
    public int Select(string match, int side, int stage, bool started, bool editing, string[] draft)
    {
        if (!editing || !started || stage != 1 || string.IsNullOrEmpty(match) || side < 0 || side > 1 || draft == null || draft.Length != 40) return -1;
        int flag = Array.IndexOf(draft, "F");
        if (flag < 0 || !entered.Add(match + ":" + side)) return -1;
        return side == 0 ? 60 + flag : 39 - flag;
    }
}
