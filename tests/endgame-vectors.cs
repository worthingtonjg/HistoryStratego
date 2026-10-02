using System;

class EndgameTests
{
	static void Check(bool b, string label)
	{
		if (!b)
			throw new Exception(label);
	}

	static void Main()
	{
		Check(!EndgamePresentation.Ready("over", "active", true, true, false), "final reveal precedes result");
		Check(!EndgamePresentation.Ready("over", "active", false, false, true), "animation precedes result");
		Check(EndgamePresentation.Ready("over", "active", false, false, false), "finished ready");
		Check(!EndgamePresentation.Ready("play", "active", false, false, false), "active game");
		Check(EndgamePresentation.Title(false, 0, "over", 0) == "The Confederates Win!", "winner");
		Check(EndgamePresentation.Title(false, 1, "over", 0) == "The Confederates Win!", "loser");
		Check(EndgamePresentation.Title(true, 1, "over", 0) == "The Confederates Win!", "neutral teacher");
		Check(EndgamePresentation.Title(false, 0, "play", -1) == "Round ended", "no fabricated winner");
		Check(EndgamePresentation.Reason(true, true, false) == "Flag captured.", "flag");
		Check(EndgamePresentation.Reason(true, false, true) == "No legal moves remain.", "no legal");
		Check(EndgamePresentation.Reason(false, false, false).Contains("No winner"), "teacher ended");
		Check(EndgamePresentation.Dismissed("a", "a", "over", "active"), "dismiss same");
		Check(!EndgamePresentation.Dismissed("b", "a", "setup", "active"), "new round");
		Check(!EndgamePresentation.Dismissed("a", "a", "play", "active"), "never hide active state");
		Check(EndgamePresentation.Dismissed("a", "a", "play", "ended"), "teacher end dismissal");
		for (int side = 0; side < 2; side++)
		{
			Check(EndgamePresentation.Title(false, side, "over", 1) == "The Union Wins!", "blue faction for either player");
			Check(EndgamePresentation.Title(true, side, "over", 1) == "The Union Wins!", "blue faction for spectator");
		}

		Check(EndgamePresentation.Flavor("ended", "play", -1) == "", "teacher end has no victory flavor");
		Check(EndgamePresentation.Flavor("ended", "over", -1) == "", "unknown winner has no victory flavor");
		for (int winner = 0; winner < 2; winner++)
		{
			var seen = new System.Collections.Generic.HashSet<string>();
			for (int i = 0; i < 40; i++)
			{
				string id = "fixture-match-" + i;
				string flavor = EndgamePresentation.Flavor(id, "over", winner);
				Check(flavor == EndgamePresentation.Flavor(id, "over", winner), "stable reconnect flavor");
				Check(flavor.Contains(winner == 0 ? "Confederates" : "Union"), "flavor matches winning faction");
				seen.Add(flavor);
			}

			Check(seen.Count >= 3, "varied result pool");
		}

		Console.WriteLine("PASS endgame precedence, titles, reasons and dismissal");
	}
}
