using System;

public static class BattleCaption
{
	public static string Piece(string rank)
	{
		switch (rank)
		{
			case "F":
				return "Flag";
			case "B":
				return "Bomb";
			case "1":
				return "Spy";
			case "2":
				return "Scout";
			case "3":
				return "Miner";
			case "4":
				return "Sgt";
			case "5":
				return "Lt";
			case "6":
				return "Captain";
			case "7":
				return "Major";
			case "8":
				return "Colonel";
			case "9":
				return "General";
			case "10":
				return "Marshal";
			default:
				return "Piece";
		}
	}

	static string Own(string name)
	{
		if (string.IsNullOrEmpty(name))
			name = "Player";
		return name + (name.EndsWith("s", StringComparison.OrdinalIgnoreCase) ? "'" : "'s");
	}

	public static string Describe(string attackerName, string defenderName, string attacker, string defender, int outcome)
	{
		string a = Own(attackerName) + " " + Piece(attacker), d = Own(defenderName) + " " + Piece(defender);
		if (outcome == 0)
			return a + " and " + d + " eliminate each other.";
		if (outcome > 0 && defender == "F")
			return a + " captures " + d + ".";
		if (outcome > 0 && attacker == "3" && defender == "B")
			return a + " disarms " + d + ".";
		if (outcome < 0 && defender == "B")
			return d + " stops " + a + ".";
		return outcome > 0 ? a + " defeats " + d + "." : d + " defeats " + a + ".";
	}
}
