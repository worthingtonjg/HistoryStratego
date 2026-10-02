using System;

class TipVectors
{
	static void Check(bool ok, string message)
	{
		if (!ok)
			throw new Exception(message);
	}

	static int First(int side, int attacking, string a, string d, int result)
	{
		var t = new BattleTips();
		t.Observe(side, "combat", attacking, a, d, result);
		t.Advance(true, 0);
		return t.Active;
	}

	static void Main()
	{
		for (int side = 0; side < 2; side++)
		{
			Check(First(side, side, "3", "B", 1) == BattleTips.Bomb, "successful defuse discovers enemy Bomb");
			Check(First(side, side, "6", "B", -1) == BattleTips.Bomb, "failed attack discovers enemy Bomb");
			Check(First(side, side, "1", "10", 1) == BattleTips.Marshal, "Spy victory still reveals enemy Marshal");
			Check(First(side, 1 - side, "10", "1", 1) == BattleTips.Marshal, "defending Spy loses; Marshal revealed");
			Check(First(side, side, "10", "10", 0) == BattleTips.Marshal, "Marshal tie reveal");
			Check(First(side, side, "3", "4", -1) == BattleTips.MinerLost, "own attacking Miner dies");
			Check(First(side, 1 - side, "4", "3", 1) == BattleTips.MinerLost, "own defending Miner dies");
			Check(First(side, side, "3", "3", 0) == BattleTips.MinerLost, "own Miner tied away");
			Check(First(side, side, "4", "3", 1) == 0, "enemy Miner loss is not own loss");
			Check(First(side, side, "10", "8", 1) == 0, "own Marshal is not enemy reveal");
		}

		var t = new BattleTips();
		t.Observe(0, "move", 1, "10", "3", 1);
		t.Advance(true, 20);
		Check(t.Active == 0, "no noncombat inference");
		t.Observe(0, "combat", 1, "10", "3", 1);
		t.Advance(false, 100);
		Check(t.Active == 0, "battle/turn-banner gate queues");
		t.Advance(true, 100);
		Check(t.Active == BattleTips.Marshal && t.Remaining == 12, "new tip grants full twelve seconds");
		t.Advance(true, 4);
		var saved = t.Save();
		t = new BattleTips(saved);
		Check(t.Active == BattleTips.Marshal && t.Remaining == 8, "reload resumes existing tip");
		t.Advance(false, 100);
		Check(t.Remaining == 8, "focus and pause exclude time");
		t.Advance(true, 8);
		Check(t.Active == 0, "automatic close");
		t.Advance(true, 0);
		Check(t.Active == BattleTips.MinerLost, "second contextual tip queued separately");
		t.Advance(true, 8);
		for (int n = 0; n < 20; n++)
		{
			t.Observe(0, "combat", 1, "10", "3", 1);
			t.Advance(true, 20);
		}

		Check(t.Active == 0 && !t.Pending, "no repeated polls or repeated trigger");
		t = new BattleTips(t.Save());
		t.Observe(0, "combat", 1, "10", "3", 1);
		t.Advance(true, 20);
		Check(t.Active == 0, "completed tips stay seen after reconnect");
		t = new BattleTips();
		t.Observe(0, "combat", 0, "2", "B", -1);
		t.Advance(true, 0);
		Check(t.Active == BattleTips.Bomb, "fresh match/player state resets");
		Check(BattleTips.Text(1) == "Bomb revealed! Only a Miner (3) can attack and defuse a Bomb.", "Bomb wording");
		Check(BattleTips.Text(2) == "Marshal (10) revealed! A Spy (1) wins if it attacks the Marshal. Another Marshal (10) ties, removing both.", "accurate Marshal wording");
		Check(BattleTips.Text(4) == "Protect your Miners! They’re the only pieces that can defuse Bombs.", "Miner wording");
		t = new BattleTips();
		t.Observe(0, "combat", 1, "10", "3", 1);
		t.Advance(true, 0);
		var gesture = new CombatClickGate();
		gesture.Observe("marshal", false);
		gesture.Press(1, false);
		gesture.Observe("marshal", true);
		Check(!gesture.Release(true), "opening or held gesture cannot dismiss");
		gesture.Press(1, true);
		Check(gesture.Release(true), "fresh completed click dismisses");
		Check(t.Dismiss(), "manual tip completes");
		t = new BattleTips(t.Save());
		t.Advance(true, 0);
		Check(t.Active == BattleTips.MinerLost, "manual dismiss persists and preserves queue");
		gesture.Observe("miner", true);
		gesture.Press(2, true);
		Check(!gesture.Release(true), "double-click cannot dismiss queued tip");
		gesture.Press(1, true);
		t.Advance(true, 8);
		gesture.Observe(null, false);
		Check(!gesture.Release(true), "timeout does not transfer a held gesture");
		Check(!t.Dismiss(), "no active tip dismissal is idempotent");
		Console.WriteLine("PASS three contextual tips, both sides, queue, duration and persistence");
	}
}
