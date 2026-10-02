using System;

// Uses only public combat ranks/outcome and stable match/event identity. No client randomness.
public static class BattleBanter
{
	public static string Category(string attacker, string defender, int outcome)
	{
		if ((attacker == "6" && defender == "7") || (attacker == "7" && defender == "6"))
			return "six-seven";
		if (defender == "F" && outcome > 0)
			return "flag";
		if (attacker == "3" && defender == "B" && outcome > 0)
			return "disarm";
		if (attacker == "1" && defender == "10" && outcome > 0)
			return "spy-win";
		if (outcome == 0)
			return "tie";
		if (defender == "B" && outcome < 0)
			return "bomb";
		string loser = outcome > 0 ? defender : attacker, winner = outcome > 0 ? attacker : defender;
		if (loser == "1")
			return "spy-out";
		if (loser == "3")
			return "miner-out";
		int rank;
		if (winner == "10" && int.TryParse(loser, out rank) && rank <= 5)
			return "marshal";
		return "capture";
	}

	public static string[] Lines(string category)
	{
		switch (category)
		{
			case "six-seven":
				return new[]
				{
					"Six Seven!!!!"
				};
			case "flag":
				return new[]
				{
					"Flag found! The search committee can go home.",
					"Special delivery: one victory flag.",
					"Objective secured. Cue the tiny victory parade!",
					"The flag has left the building. Game over!"
				};
			case "disarm":
				return new[]
				{
					"The surprise party has officially been canceled.",
					"Somebody read the instructions before touching anything.",
					"That hazard just became yesterday's problem.",
					"Special training beats a very sneaky obstacle.",
					"A little know-how cleared a big problem."
				};
			case "spy-win":
				return new[]
				{
					"Turns out whispers can topple big reputations.",
					"I prefer a quiet entrance and a big surprise.",
					"That secret came with an exit notice.",
					"Leadership just lost a game of peekaboo.",
					"A whisper just canceled the victory speech.",
					"The command tent has an unexpected vacancy."
				};
			case "tie":
				return new[]
				{
					"Both pieces booked the same exit.",
					"A perfect tie. An empty square.",
					"Nobody won, but the board gained elbow room.",
					"Two tickets to the sidelines, please.",
					"The staring contest ended in double checkout.",
					"Matching confidence. Matching results. Matching exit doors."
				};
			case "bomb":
				return new[]
				{
					"That square had a strict no-visitors policy.",
					"Surprise! The welcome mat was a warning label.",
					"The advance came with a loud plot twist.",
					"A bold move met an explosive footnote.",
					"That square really values its personal space.",
					"The board's least friendly doorbell just rang."
				};
			case "spy-out":
				return new[]
				{
					"The secret mission became public information.",
					"Stealth mode has officially logged out.",
					"That disguise needed one more rehearsal.",
					"A quiet plan met a loud objection.",
					"The cover story didn't survive the meeting.",
					"Classified mission. Very visible exit."
				};
			case "miner-out":
				return new[]
				{
					"Wrong assignment. This wasn't a demolition job.",
					"The toolbox didn't include an escape plan.",
					"You'll need more than a toolbox to move me.",
					"This matchup required a different set of tools.",
					"The safety briefing missed this particular encounter.",
					"No amount of digging could fix that matchup."
				};
			case "marshal":
				return new[]
				{
					"That matchup had a very short agenda.",
					"Command experience just shortened the conversation.",
					"I have a reputation to maintain.",
					"I brought my best answer.",
					"Upper management has concluded this meeting.",
					"The chain of command held up nicely."
				};
			default:
				return new[]
				{
					"I think I'll keep this square.",
					"The board just got a little roomier.",
					"I'll be here for the next roll call.",
					"Thanks for visiting. I have this square covered.",
					"A short meeting with a clear result.",
					"I'll finish this strategy session from here."
				};
		}
	}

	public static string Choose(string matchId, int seq, string attacker, string defender, int outcome, string previous = "")
	{
		string[] lines = Lines(Category(attacker, defender, outcome));
		uint hash = 2166136261;
		string seed = matchId + ":" + seq + ":" + attacker + ":" + defender + ":" + outcome;
		unchecked
		{
			foreach (char c in seed)
			{
				hash ^= c;
				hash *= 16777619;
			}
		}

		int index = (int)(hash % (uint)lines.Length);
		if (lines[index] == previous)
			index = (index + 1) % lines.Length;
		return lines[index];
	}
}
