public static class SelectedPieceDetails
{
	// Consume only the server-redacted perspective and current authoritative selection.
	public static PieceView Visible(MatchView m, string sessionPhase, int inspected = -1)
	{
		if (m == null || sessionPhase == "ended" || m.phase != "play" || m.blocked || m.setupBlocked || (m.battle != null && m.battle.kind == "combat") || (m.turnClock != null && m.turnClock.noticeRemainingMs > 0))
			return null;
		if (inspected == -2)
			return null;
		var s = inspected >= 0 ? new SelectionView
		{
			from = inspected,
			side = m.side,
			seq = m.seq
		}

		: m.selection;
		if (s == null || s.seq != m.seq || s.side != m.side || m.turn != m.side || s.from < 0 || s.from >= (m.board == null ? 0 : m.board.Length))
			return null;
		var p = m.board[s.from];
		if (p == null || p.side != m.side || string.IsNullOrEmpty(p.rank) || p.rank == "?")
			return null;
		if (inspected >= 0 && p.rank != "B" && p.rank != "F")
			return null;
		return p;
	}

	public static string Rule(string rank)
	{
		switch (rank)
		{
			case "1":
				return "Moves one square. Defeats the Marshal only when the Spy attacks; loses to other numbered ranks.";
			case "2":
				return "Moves any clear distance in a straight line. Cannot jump pieces or lakes; stops when attacking.";
			case "3":
				return "Moves one square. The only piece that can attack and remove a Bomb without being removed.";
			case "10":
				return "Moves one square. Highest numbered rank; vulnerable to an attacking Spy and to Bombs.";
			case "B":
				return "Cannot move. Defeats attackers except Miners, who remove it.";
			case "F":
				return "Cannot move. Protect it: an opponent captures your Flag to win.";
			default:
				return "Moves one square horizontally or vertically. Higher number wins; equal ranks remove both pieces.";
		}
	}

	public static string Flavor(string rank)
	{
		switch (rank)
		{
			case "1":
				return "Quiet planning can challenge great strength.";
			case "2":
				return "Information can be as valuable as territory.";
			case "3":
				return "The right specialist opens a protected route.";
			case "10":
				return "Great strength still needs careful scouting.";
			case "B":
				return "A strong defense makes an opponent rethink the route.";
			case "F":
				return "Every formation needs a purpose worth protecting.";
			default:
				return "Choose the ground. Support the advance. Protect the objective.";
		}
	}
}
