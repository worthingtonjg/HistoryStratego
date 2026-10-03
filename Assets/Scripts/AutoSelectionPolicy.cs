using System;
using System.Collections.Generic;

// Candidate ordering uses only this player's visible army and the public move journal.
// The normal selection endpoint remains authoritative for the returned legal targets.
public static class AutoSelectionPolicy
{
	sealed class OwnMove
	{
		public string Identity;
		public int From, To;
	}

	public static int[] Candidates(MatchView match)
	{
		if (match == null || match.board == null || match.board.Length != 100 || match.side < 0 || match.side > 1)
			return Array.Empty<int>();
		var positions = new Dictionary<int, string>();
		var recent = new List<OwnMove>();
		string lastIdentity = null;
		int serial = 0;
		foreach (var entry in match.events ?? Array.Empty<Dispatch>())
		{
			if (entry == null || (entry.kind != "move" && entry.kind != "combat"))
				continue;
			if (entry.side == match.side)
			{
				if (!positions.TryGetValue(entry.from, out var identity))
					identity = "own-" + (++serial);
				positions.Remove(entry.from);
				lastIdentity = identity;
				if (entry.kind != "combat" || entry.outcome > 0)
					positions[entry.to] = identity;
				recent.Add(new OwnMove { Identity = identity, From = entry.from, To = entry.to });
				if (recent.Count > 2)
					recent.RemoveAt(0);
			}
			else if (entry.kind == "combat" && entry.outcome >= 0)
			{
				// A victorious enemy attack or tie removes the defending own piece.
				positions.Remove(entry.to);
			}
		}

		var candidates = new List<int>();
		for (int square = 0; square < 100; square++)
		{
			var piece = match.board[square];
			if (piece == null || piece.side != match.side || !MovableRank(piece.rank, out _))
				continue;
			if (HasMove(match, square, positions, recent))
				candidates.Add(square);
		}

		candidates.Sort((a, b) =>
		{
			int frontA = a / 10 == (match.side == 0 ? 6 : 3) ? 0 : 1;
			int frontB = b / 10 == (match.side == 0 ? 6 : 3) ? 0 : 1;
			int order = frontA.CompareTo(frontB);
			if (order != 0)
				return order;
			MovableRank(match.board[a].rank, out int rankA);
			MovableRank(match.board[b].rank, out int rankB);
			order = rankA.CompareTo(rankB);
			return order != 0 ? order : match.side == 0 ? a.CompareTo(b) : b.CompareTo(a);
		});
		// Identity survives consecutive moves and is removed on a recorded capture.
		// Another own piece later occupying the same square has a different identity.
		if (lastIdentity != null)
		{
			foreach (var position in positions)
			{
				if (position.Value == lastIdentity && candidates.Remove(position.Key))
				{
					candidates.Insert(0, position.Key);
					break;
				}
			}
		}

		return candidates.ToArray();
	}

	static bool MovableRank(string rank, out int number)
	{
		return int.TryParse(rank, out number) && number >= 1 && number <= 10;
	}

	static bool Lake(int square)
	{
		int row = square / 10, column = square % 10;
		return (row == 4 || row == 5) && (column == 2 || column == 3 || column == 6 || column == 7);
	}

	static bool HasMove(MatchView match, int from, Dictionary<int, string> positions, List<OwnMove> recent)
	{
		int[] dx =
		{
			0,
			0,
			-1,
			1
		}, dy =
		{
			-1,
			1,
			0,
			0
		};
		int distance = match.board[from].rank == "2" ? 9 : 1;
		for (int direction = 0; direction < 4; direction++)
		{
			for (int step = 1; step <= distance; step++)
			{
				int x = from % 10 + dx[direction] * step, y = from / 10 + dy[direction] * step;
				if (x < 0 || x > 9 || y < 0 || y > 9)
					break;
				int to = y * 10 + x;
				if (Lake(to) || match.board[to]?.side == match.side)
					break;
				return true;
			}
		}

		return false;
	}
}
