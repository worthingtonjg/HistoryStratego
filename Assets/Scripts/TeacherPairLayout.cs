using System;
using System.Collections.Generic;

public class TeacherPairGroup
{
	public int number;
	public RosterEntry[] members;
}

public class TeacherPairSnapshot
{
	public TeacherPairGroup[] pairs;
	public RosterEntry[] waiting;
}

public static class TeacherPairLayout
{
	public static TeacherPairSnapshot Build(RosterEntry[] roster)
	{
		var groups = new SortedDictionary<int, List<RosterEntry>>();
		var waiting = new List<RosterEntry>();
		foreach (var player in roster ?? Array.Empty<RosterEntry>())
		{
			if (player.waiting || player.pair <= 0)
			{
				waiting.Add(player);
				continue;
			}

			if (!groups.ContainsKey(player.pair))
				groups[player.pair] = new List<RosterEntry>();
			groups[player.pair].Add(player);
		}

		var pairs = new List<TeacherPairGroup>();
		foreach (var group in groups)
			pairs.Add(new TeacherPairGroup { number = group.Key, members = group.Value.ToArray() });
		return new TeacherPairSnapshot
		{
			pairs = pairs.ToArray(),
			waiting = waiting.ToArray()
		};
	}

	public static MatchSummary MatchFor(TeacherPairGroup pair, MatchSummary[] matches)
	{
		if (pair.members.Length != 2)
			return null;
		foreach (var match in matches ?? Array.Empty<MatchSummary>())
			if (match.players != null && match.players.Length == 2 && Array.IndexOf(match.players, pair.members[0].id) >= 0 && Array.IndexOf(match.players, pair.members[1].id) >= 0)
				return match;
		return null;
	}
}
