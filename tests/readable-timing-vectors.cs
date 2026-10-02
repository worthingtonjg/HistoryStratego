using System;

public static class ReadableTimingVectors
{
	static void Check(bool ok, string message)
	{
		if (!ok)
			throw new Exception(message);
	}

	public static void Main()
	{
		var t = new ReadableTiming();
		for (int i = 0; i < 19; i++)
			t.Observe("battle", true, .25f);
		Check(t.Elapsed < 5, "not early");
		for (int i = 0; i < 100; i++)
			t.Observe("battle", false, .25f);
		Check(t.Elapsed == 4.75f, "pause/hidden frozen");
		t.Observe("battle", false, 20);
		Check(t.Elapsed == 4.75f, "excluded background time ignored");
		t.Observe("battle", true, .25f);
		Check(t.Elapsed == 5, "five readable seconds");
		t.Retry();
		for (int i = 0; i < 4; i++)
			t.Observe("battle", true, 1.25f);
		Check(t.Elapsed == 5, "slow foreground frames still reach threshold");
		var gate = new CombatClickGate();
		gate.Observe("battle", true);
		Check(gate.AutoAdvance(true), "auto first");
		gate.Press(1, true);
		Check(!gate.Release(true), "manual duplicate suppressed");
		Check(!gate.AutoAdvance(true), "auto duplicate suppressed");
		gate.Observe("next", true);
		gate.Press(1, true);
		Check(gate.Release(true), "manual first");
		Check(!gate.AutoAdvance(true), "auto after manual suppressed");
		t.Retry();
		Check(t.Elapsed == 0, "failed ack gets new reading interval");
		t.Observe("turn", true, .5f);
		for (int i = 0; i < 29; i++)
			t.Observe("turn", true, .5f);
		Check(t.Elapsed == 15, "turn reminder threshold");
		Check(t.InWindow(15, 3), "reminder opens at fifteen");
		Check(ReadableTiming.Reminder("turn").EndsWith("\n- Take your turn dummy!"), "exact reminder suffix");
		t.Observe("turn", false, 20);
		Check(t.InWindow(15, 3), "pause preserves remaining panel time");
		t.Observe("turn", true, 2.99f);
		Check(t.InWindow(15, 3), "panel stays until three seconds");
		t.Observe("turn", true, .02f);
		Check(!t.InWindow(15, 3), "three-second automatic close");
		t.Observe("turn", true, 30);
		Check(!t.InWindow(15, 3), "no same-turn repeat");
		Check(ReadableTiming.Reminder("turn") == ReadableTiming.Reminder("turn"), "stable wording");
		t.Observe("next-turn", true, 0);
		Check(t.Elapsed == 0, "new turn resets");
		var reload = new ReadableTiming();
		Check(reload.Elapsed == 0, "reload safely grants full readable interval");
		Console.WriteLine("PASS readable timing and manual/auto races");
	}
}
