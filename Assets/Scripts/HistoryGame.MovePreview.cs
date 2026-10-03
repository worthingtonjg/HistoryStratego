using UnityEngine;
public partial class HistoryGame
{
    sealed class MovePreview
    {
        public string Match;
        public int From, To, Seq;
        public PieceView Piece;
        public bool Attack, Confirmed;
        public float Started;
        public float Progress(float now) => Mathf.Clamp01((now - Started) / .35f);
    }
    MovePreview movePreview;
    void BeginMovePreview(MatchView m, int from, int to)
    {
        if (movePreview != null || teacherMode || CachedSelection(m, from)?.targets == null) return;
        if (!System.Array.Exists(CachedSelection(m, from).targets, t => t.to == to)) return;
        movePreview = new MovePreview { Match=m.id, From=from, To=to, Seq=m.seq, Piece=m.board[from], Attack=m.board[to]!=null, Started=Time.unscaledTime };
        boostUntil = Time.unscaledTime + .5f;
        if (Application.absoluteURL.Contains("qa=1")) Debug.Log("MOVE_PREVIEW_STARTED " + from + " " + to);
    }
    void ClearMovePreview(string reason)
    {
        if (movePreview == null) return;
        movePreview = null;
        tabletop?.InvalidatePositions();
        if (Application.absoluteURL.Contains("qa=1")) Debug.Log("MOVE_PREVIEW_CLEARED " + reason);
    }
    void ObserveMovePreview(MatchView m)
    {
        if (movePreview == null) return;
        var p = movePreview;
        if (teacherMode || state.phase != "active" || m.id != p.Match || m.phase != "play" || apiStatus != "") { ClearMovePreview("context"); return; }
        if (p.Confirmed) { if (m.seq != p.Seq + 1 || p.Progress(Time.unscaledTime) >= 1) ClearMovePreview("finished"); return; }
        if (m.seq != p.Seq || m.turn != m.side || m.blocked || m.setupBlocked || DeadlineBlocked(m)) ClearMovePreview("position-changed");
    }
}
