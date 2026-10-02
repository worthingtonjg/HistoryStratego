using System;

class TurnTests
{
	static void Check(bool x, string message)
	{
		if (!x)
			throw new Exception(message);
	}

	static void Main()
	{
		foreach (int side in new[]
		{
			0,
			1
		}

		)
		{
			var t = new TurnNotice();
			Check(!t.Observe("a", side, 0, "setup", false), "setup quiet");
			Check(t.Observe("a", side, side, "play", true), "first own actionable turn");
			Check(!t.Observe("a", side, side, "play", true), "poll quiet");
			Check(!t.Observe("a", side, side, "play", false), "pause quiet");
			Check(!t.Observe("a", side, side, "play", true), "resume quiet");
			Check(!t.Observe("a", side, 1 - side, "play", true), "opponent quiet");
			Check(!t.Observe("a", side, side, "play", false), "combat barrier and animation wait");
			Check(!t.Observe("a", side, side, "play", false), "continued waiting");
			Check(t.Observe("a", side, side, "play", true), "barrier clear once");
			Check(!t.Observe("a", side, side, "play", true), "selection/poll quiet");
			Check(!t.Observe("a", side, side, "over", false), "result quiet");
			var reload = new TurnNotice();
			Check(!reload.Observe("a", side, side, "play", true), "reload quiet");
			Check(!reload.Observe("a", side, side, "play", true), "reload polling quiet");
			var blockedReload = new TurnNotice();
			Check(!blockedReload.Observe("a", side, side, "play", false), "reload combat quiet");
			Check(!blockedReload.Observe("a", side, side, "play", true), "reload combat clear quiet");
		}

		Console.WriteLine("PASS turn transitions both sides, first turn, barrier, reload, pause and polling");
	}
}
