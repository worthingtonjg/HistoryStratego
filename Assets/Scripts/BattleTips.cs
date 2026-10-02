using System;
using System.Globalization;

// Inputs are this player's public combat events only; no board or hidden ranks.
public sealed class BattleTips
{
	public const int Bomb = 1, Marshal = 2, MinerLost = 4;
	int discovered, completed;
	public int Active { get; private set; }
	public float Remaining { get; private set; }

	public bool Pending
	{
		get
		{
			return (discovered & ~completed) != 0;
		}
	}

	public BattleTips(string saved = "")
	{
		var values = (saved ?? "").Split('|');
		int d, c, a;
		float remaining;
		if (values.Length == 4 && int.TryParse(values[0], out d) && int.TryParse(values[1], out c) && int.TryParse(values[2], out a) && float.TryParse(values[3], NumberStyles.Float, CultureInfo.InvariantCulture, out remaining) && (a == 0 || a == Bomb || a == Marshal || a == MinerLost) && !float.IsNaN(remaining) && !float.IsInfinity(remaining))
		{
			discovered = d & 7;
			completed = c & discovered;
			Active = (a & discovered & ~completed) != 0 ? a : 0;
			Remaining = Active == 0 ? 0 : Math.Max(0, Math.Min(Duration(Active), remaining));
		}
	}

	public void Observe(int ownSide, string kind, int attackingSide, string attacker, string defender, int outcome)
	{
		if (kind != "combat" || ownSide < 0 || ownSide > 1 || attackingSide < 0 || attackingSide > 1)
			return;
		bool attacking = ownSide == attackingSide;
		string enemy = attacking ? defender : attacker, own = attacking ? attacker : defender;
		if (enemy == "B")
			discovered |= Bomb;
		if (enemy == "10")
			discovered |= Marshal;
		if (own == "3" && (attacking ? outcome <= 0 : outcome >= 0))
			discovered |= MinerLost;
	}

	public void Advance(bool eligible, float seconds)
	{
		if (!eligible)
			return;
		if (Active == 0)
		{
			foreach (int id in new[]
			{
				Bomb,
				Marshal,
				MinerLost
			}

			)
				if ((discovered & ~completed & id) != 0)
				{
					Active = id;
					Remaining = Duration(id);
					return;
				}
		}
		else if (seconds > 0 && !float.IsNaN(seconds) && !float.IsInfinity(seconds))
		{
			Remaining = Math.Max(0, Remaining - seconds);
			if (Remaining == 0)
				Dismiss();
		}
	}

	public bool Dismiss()
	{
		if (Active == 0)
			return false;
		completed |= Active;
		Active = 0;
		Remaining = 0;
		return true;
	}

	public string Save()
	{
		return discovered + "|" + completed + "|" + Active + "|" + Remaining.ToString("R", CultureInfo.InvariantCulture);
	}

	public static float Duration(int id)
	{
		return id == Marshal ? 12 : 8;
	}

	public static string Text(int id)
	{
		if (id == Bomb)
			return "Bomb revealed! Only a Miner (3) can attack and defuse a Bomb.";
		if (id == Marshal)
			return "Marshal (10) revealed! A Spy (1) wins if it attacks the Marshal. Another Marshal (10) ties, removing both.";
		if (id == MinerLost)
			return "Protect your Miners! They’re the only pieces that can defuse Bombs.";
		return "";
	}
}
