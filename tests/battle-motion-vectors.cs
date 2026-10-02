using System;

class MotionTests
{
	static void Check(bool b, string label)
	{
		if (!b)
			throw new Exception(label);
	}

	static void Main()
	{
		foreach (string a in new[]
		{
			"2",
			"3",
			"1",
			"10"
		}

		)
			foreach (int outcome in new[]
			{
				-1,
				0,
				1
			}

			)
			{
				float last = -.85f;
				foreach (float p in new[]
				{
					0f,
					.25f,
					.5f,
					.52f,
					.75f,
					1f
				}

				)
				{
					var pose = BattleMotion.At(a, outcome, p);
					Check(pose.defenderX == .85f, "defender translated");
					Check(pose.attackerX >= last, "attacker retreats");
					last = pose.attackerX;
					if (p <= .5f)
						Check(pose.attackerFall == 0 && pose.defenderFall == 0, "fall before approach complete");
					if (p == 1)
					{
						Check(pose.attackerX > -.85f, "attacker did not approach");
						Check((pose.attackerFall > 0) == (outcome <= 0), "attacker loser role");
						Check((pose.defenderFall < 0) == (outcome >= 0), "defender loser role");
					}
				}
			}

		foreach (string fixedRank in new[]
		{
			"B",
			"F"
		}

		)
			foreach (int o in new[]
			{
				-1,
				0,
				1
			}

			)
				Check(BattleMotion.At(fixedRank, o, .5f).attackerX == -.85f, "immobile rank translated");
		Console.WriteLine("PASS role-based approach and loser-only toppling");
	}
}
