using System;

class TeacherActionsVectors
{
	static void Check(bool result)
	{
		if (!result)
			throw new Exception("Teacher action policy failed");
	}

	static bool V(string a, string p, int x, int y, bool running)
	{
		return TeacherActionPolicy.Visible(a, p, x, y, running);
	}

	public static void Main()
	{
		foreach (string phase in new[]
		{
			"waiting",
			"ended"
		}

		)
		{
			Check(!V("start", phase, 0, 0, false));
			Check(!V("randomize", phase, 2, 0, false));
			Check(V("start", phase, 1, 1, false));
			Check(V("randomize", phase, 1, 1, false));
			Check(!V("pause", phase, 1, 1, true));
			Check(!V("resume", phase, 1, 1, true));
			Check(!V("end", phase, 1, 1, true));
		}

		Check(V("pause", "active", 1, 1, true));
		Check(!V("resume", "active", 1, 1, true));
		Check(V("end", "active", 1, 1, true));
		Check(!V("start", "active", 1, 1, true));
		Check(!V("randomize", "active", 1, 1, true));
		Check(V("resume", "paused", 1, 1, true));
		Check(!V("pause", "paused", 1, 1, true));
		Check(V("end", "paused", 1, 1, true));
		Check(!V("start", "paused", 1, 1, true));
		Check(!V("pause", "active", 1, 1, false));
		Check(!V("resume", "paused", 1, 1, false));
		Check(V("end", "active", 1, 1, false));
		Check(V("end", "paused", 1, 1, false));
		Check(!V("start", "active", 1, 1, false));
		// An ended round can have retained match summaries; connected players may form a fresh round.
		Check(V("start", "ended", 1, 1, true));
		Check(!V("unknown", "active", 1, 1, true));
		Console.WriteLine("PASS teacher action states");
	}
}
