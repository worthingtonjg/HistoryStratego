using System;

class BanterTests
{
	static void Check(bool b, string label)
	{
		if (!b)
			throw new Exception(label);
	}

	static void Cat(string a, string d, int o, string c)
	{
		Check(BattleBanter.Category(a, d, o) == c, a + "/" + d + " category " + c);
	}

	static void Main()
	{
		Cat("3", "B", 1, "disarm");
		Cat("1", "10", 1, "spy-win");
		Cat("10", "1", 1, "spy-out");
		Cat("1", "1", 0, "tie");
		Cat("3", "3", 0, "tie");
		Cat("1", "B", -1, "bomb");
		Cat("10", "B", -1, "bomb");
		Cat("3", "10", -1, "miner-out");
		Cat("10", "3", 1, "miner-out");
		Cat("10", "5", 1, "marshal");
		Cat("2", "10", -1, "marshal");
		Cat("10", "6", 1, "capture");
		Cat("4", "2", 1, "capture");
		Cat("2", "F", 1, "flag");
		Cat("6", "7", -1, "six-seven");
		Cat("7", "6", 1, "six-seven");
		for (int seq = 1; seq <= 200; seq++)
			foreach (string attacker in new[]
			{
				"6",
				"7"
			}

			)
			{
				string defender = attacker == "6" ? "7" : "6";
				int outcome = attacker == "6" ? -1 : 1;
				string exact = BattleBanter.Choose("shared-public-match", seq, attacker, defender, outcome, "Six Seven!!!!");
				Check(exact == "Six Seven!!!!", "exact override both orientations, repeated events and synchronized replay");
				Check(CutscenePresentation.Speaker(exact, attacker, defender, outcome, "Commander") == "Commander's Major", "surviving rank seven speaks with separate credit");
			}

		string previous = "";
		for (int seq = 1; seq <= 200; seq++)
		{
			string line = BattleBanter.Choose("public-match", seq, "2", "2", 0, previous);
			Check(line != previous, "consecutive duplicate");
			Check(line == BattleBanter.Choose("public-match", seq, "2", "2", 0, previous), "poll/reconnect determinism");
			previous = line;
		}

		foreach (string c in new[]
		{
			"disarm",
			"spy-win",
			"tie",
			"bomb",
			"spy-out",
			"miner-out",
			"marshal",
			"capture",
			"flag"
		}

		)
			Check(BattleBanter.Lines(c).Length >= 4, "variety");
		Console.WriteLine("PASS: 14 category/priority cases, 200 deterministic replay/repeat vectors, 9 varied pools");
	}
}
