// Local read-only inspection never changes authoritative move selection.
public sealed class OwnPieceInspection
{
	string match = "";
	int sequence = -1, side = -1, index = -1;
	public int Index(MatchView m)
	{
		if (m == null || m.id != match || m.seq != sequence || m.side != side || m.turn != side || m.phase != "play" || m.blocked || m.setupBlocked || (m.battle != null && m.battle.kind == "combat") || (m.turnClock != null && m.turnClock.noticeRemainingMs > 0))
		{
			Clear();
			return -1;
		}

		if (index >= 0 && SelectedPieceDetails.Visible(m, "active", index) == null)
		{
			Clear();
			return -1;
		}

		return index;
	}

	public void Toggle(MatchView m, int cell)
	{
		if (SelectedPieceDetails.Visible(m, "active", cell) == null)
			return;
		int next = Index(m) == cell ? -2 : cell;
		match = m.id;
		sequence = m.seq;
		side = m.side;
		index = next;
	}

	public void Deselect(MatchView m)
	{
		match = m.id;
		sequence = m.seq;
		side = m.side;
		index = -2;
	}

	public void Clear()
	{
		match = "";
		sequence = -1;
		side = -1;
		index = -1;
	}
}
