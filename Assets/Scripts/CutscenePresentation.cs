using System;

public static class CutscenePresentation
{
	// Every ordinary survivor speaks; ties and all bomb encounters remain unattributed.
	public static string Speaker(string quote, string attacker, string defender, int outcome, string winnerName)
	{
		if (outcome == 0 || attacker == "B" || defender == "B")
			return "";
		return winnerName + (winnerName.EndsWith("s", StringComparison.OrdinalIgnoreCase) ? "'" : "'s") + " " + BattleCaption.Piece(outcome > 0 ? attacker : defender);
	}
}
