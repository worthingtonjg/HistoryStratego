public static class EndgamePresentation
{
	public static bool Terminal(string matchPhase, string classroomPhase)
	{
		return matchPhase == "over" || classroomPhase == "ended";
	}

	public static bool WinnerKnown(string matchPhase, int winner)
	{
		return matchPhase == "over" && (winner == 0 || winner == 1);
	}

	public static bool Ready(string matchPhase, string classroomPhase, bool pendingBattle, bool blocked, bool animation)
	{
		return Terminal(matchPhase, classroomPhase) && !pendingBattle && !blocked && !animation;
	}

	public static string Title(bool teacher, int side, string matchPhase, int winner)
	{
		return !WinnerKnown(matchPhase, winner) ? "Round ended" : winner == 0 ? "The Confederates Win!" : "The Union Wins!";
	}

	// Seat 0 is red/Confederate; seat 1 is blue/Union, independent of nicknames.
	static readonly string[][] resultLines =
	{
		new[]
		{
			"On this board, the Confederates turned careful planning into victory.",
			"The Confederates kept their objective in sight and finished this match.",
			"Patience and positioning brought the Confederates success this round.",
			"The Confederates found the opening that decided this game.",
			"The Confederates' next move became the match's final move.",
			"A well-timed advance secured this board for the Confederates."
		},
		new[]
		{
			"On this board, the Union turned careful planning into victory.",
			"The Union kept its objective in sight and finished this match.",
			"Patience and positioning brought the Union success this round.",
			"The Union found the opening that decided this game.",
			"The Union's next move became the match's final move.",
			"A well-timed advance secured this board for the Union."
		}
	};
	public static string Flavor(string matchId, string matchPhase, int winner)
	{
		if (!WinnerKnown(matchPhase, winner))
			return "";
		// The random match identity seeds a shared choice; polling and reconnect never reroll it.
		uint hash = 2166136261;
		unchecked
		{
			foreach (char character in (matchId ?? "") + ":" + winner)
				hash = (hash ^ character) * 16777619;
		}

		var pool = resultLines[winner];
		return pool[hash % (uint)pool.Length];
	}

	public static string Reason(bool hasWinner, bool flag, bool noLegal)
	{
		return !hasWinner ? "The teacher ended this round. No winner was declared." : flag ? "Flag captured." : noLegal ? "No legal moves remain." : "Match completed.";
	}

	public static bool Dismissed(string matchId, string dismissedId, string matchPhase, string classroomPhase)
	{
		return !string.IsNullOrEmpty(matchId) && matchId == dismissedId && Terminal(matchPhase, classroomPhase);
	}
}
