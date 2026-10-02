using System;

public class RosterEntry
{
	public string id;
	public int pair;
	public bool waiting;
}

public class MatchSummary
{
	public string id;
	public string[] players;
}

class PairVectors
{
	static void Check(bool b)
	{
		if (!b)
			throw new Exception("Pair grouping failed");
	}

	public static void Main()
	{
		RosterEntry a = new RosterEntry
		{
			id = "a",
			pair = 1
		}, b = new RosterEntry
		{
			id = "b",
			pair = 1
		}, c = new RosterEntry
		{
			id = "c",
			pair = 2
		}, d = new RosterEntry
		{
			id = "d",
			pair = 2
		}, late = new RosterEntry
		{
			id = "late",
			pair = 0,
			waiting = true
		};
		var p = TeacherPairLayout.Build(new[] { d, late, a, b, c });
		Check(p.pairs.Length == 2);
		Check(p.pairs[0].number == 1);
		Check(p.pairs[0].members.Length == 2);
		Check(p.waiting.Length == 1 && p.waiting[0].id == "late");
		var m = new MatchSummary
		{
			id = "match",
			players = new[]
			{
				"b",
				"a"
			}
		};
		Check(TeacherPairLayout.MatchFor(p.pairs[0], new[] { m }) == m);
		Check(TeacherPairLayout.MatchFor(p.pairs[1], new[] { m }) == null);
		a.waiting = true;
		p = TeacherPairLayout.Build(new[] { a, b, late });
		Check(p.waiting.Length == 2);
		Check(TeacherPairLayout.MatchFor(p.pairs[0], new[] { m }) == null);
		Console.WriteLine("PASS pair grouping and waiting");
	}
}
