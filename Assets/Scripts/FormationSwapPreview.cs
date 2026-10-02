// A local visual preview only; authoritative draft/revision always decide acceptance.
public sealed class FormationSwapPreview
{
    public readonly string[] Before;
    public readonly int From, To, Revision;
    public readonly float Started;
    public bool Active { get; private set; }
    public bool Pending { get; private set; }
    public FormationSwapPreview(string[] draft, int from, int to, int revision, float now)
    {
        Before = (string[])draft.Clone(); From = from; To = to; Revision = revision; Started = now;
        Active = Pending = true;
    }
    public float Progress(float now) { return System.Math.Max(0, System.Math.Min(1, (now - Started) / .35f)); }
    public bool BlocksInput(float now) { return Active && (Pending || Progress(now) < 1); }
    public void Cancel() { Active = Pending = false; }
    public void Observe(string[] draft, int revision, bool validContext)
    {
        if (!Active) return;
        if (!validContext || draft == null || draft.Length != 40) { Cancel(); return; }
        if (revision == Revision)
        {
            for (int i = 0; i < 40; i++) if (draft[i] != Before[i]) { Cancel(); return; }
            return; // The in-flight read still describes the pre-click formation.
        }
        if (FormationExchange.Confirmed(Before, draft, From, To, Revision, revision)) Pending = false;
        else Cancel();
    }
}