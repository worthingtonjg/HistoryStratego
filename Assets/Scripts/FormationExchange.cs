public static class FormationExchange
{
    public static bool Confirmed(string[] before, string[] after, int from, int to, int priorRevision, int nextRevision)
    {
        if (before == null || after == null || before.Length != 40 || after.Length != 40 || from < 0 || from >= 40 || to < 0 || to >= 40 || from == to || nextRevision != priorRevision + 1) return false;
        for (int i = 0; i < 40; i++)
            if (after[i] != before[i == from ? to : i == to ? from : i]) return false;
        return true;
    }
}