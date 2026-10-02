using System;
using System.Linq;

// Minimal view shapes keep these policy tests independent of the Unity runtime.
public class PieceView
{
	public int side;
	public string rank;
}

public class Dispatch
{
	public string kind;
	public int side, from, to, outcome;
}

public class MatchView
{
	public int side;
	public PieceView[] board = new PieceView[100];
	public Dispatch[] events = new Dispatch[0];
}

class AutoSelectionVectors
{
	static PieceView P(int side, string rank)
	{
		return new PieceView
		{
			side = side,
			rank = rank
		};
	}

	static Dispatch E(int side, int from, int to, string kind = "move", int outcome = 0)
	{
		return new Dispatch
		{
			side = side,
			from = from,
			to = to,
			kind = kind,
			outcome = outcome
		};
	}

	static void First(MatchView m, int expected, string label)
	{
		int[] result = AutoSelectionPolicy.Candidates(m);
		if (result.Length == 0 || result[0] != expected)
			throw new Exception(label + ": " + string.Join(",", result));
	}

	static void Main()
	{
		var red = new MatchView
		{
			side = 0
		};
		red.board[60] = P(0, "2");
		red.board[61] = P(0, "1");
		red.board[69] = P(0, "1");
		First(red, 61, "red front-row rank then left-to-right");
		var blue = new MatchView
		{
			side = 1
		};
		blue.board[39] = P(1, "2");
		blue.board[38] = P(1, "1");
		blue.board[31] = P(1, "1");
		First(blue, 38, "blue side-relative left-to-right");
		var moved = new MatchView
		{
			side = 0,
			events = new[]
			{
				E(0, 60, 50),
				E(1, 10, 20),
				E(0, 50, 51)
			}
		};
		moved.board[51] = P(0, "8");
		moved.board[61] = P(0, "1");
		First(moved, 51, "identity follows repeated moves ahead of lower rank");
		moved.events = new[]
		{
			E(0, 60, 50),
			E(1, 40, 50, "combat", 1)
		};
		moved.board[51] = null;
		moved.board[50] = P(1, "?");
		First(moved, 61, "captured last piece falls back");
		moved.board[50] = P(0, "10");
		First(moved, 61, "old square never identifies a replacement piece");
		moved.events = new[]
		{
			E(0, 60, 50),
			E(1, 40, 50, "combat", -1)
		};
		First(moved, 50, "surviving defender retains identity");
		foreach (int outcome in new[]
		{
			-1,
			0
		}

		)
		{
			var dead = new MatchView
			{
				side = 0,
				events = new[]
				{
					E(0, 60, 50, "combat", outcome)
				}
			};
			dead.board[61] = P(0, "2");
			dead.board[50] = outcome < 0 ? P(1, "?") : null;
			First(dead, 61, "losing or tied own attack falls back");
		}

		var reused = new MatchView
		{
			side = 0,
			events = new[]
			{
				E(0, 60, 50),
				E(1, 40, 50, "combat", 1),
				E(0, 61, 50, "combat", 1),
				E(1, 40, 50, "combat", -1)
			}
		};
		reused.board[50] = P(0, "5");
		reused.board[60] = P(0, "1");
		First(reused, 50, "later own piece has its own surviving lineage");
		var blocked = new MatchView
		{
			side = 0,
			events = new[]
			{
				E(0, 60, 50)
			}
		};
		blocked.board[50] = P(0, "1");
		foreach (int i in new[]
		{
			40,
			51,
			60
		}

		)
			blocked.board[i] = P(0, "B");
		blocked.board[61] = P(0, "2");
		First(blocked, 61, "blocked last piece uses front fallback");
		blocked.board[61] = null;
		blocked.board[79] = P(0, "4");
		First(blocked, 79, "fallback outside front row");
		blocked.board[79] = null;
		if (AutoSelectionPolicy.Candidates(blocked).Length != 0)
			throw new Exception("no movable piece must remain unselected");
		var repeat = new MatchView
		{
			side = 0,
			events = new[]
			{
				E(0, 60, 50),
				E(0, 50, 60)
			}
		};
		repeat.board[60] = P(0, "4");
		repeat.board[61] = P(0, "B");
		repeat.board[70] = P(0, "B");
		repeat.board[79] = P(0, "5");
		First(repeat, 79, "two-square restriction can make last piece blocked");
		repeat.board[60].rank = "2";
		First(repeat, 60, "scout may pass forbidden adjacent return to a further legal square");
		var privacy = new MatchView
		{
			side = 0
		};
		privacy.board[60] = P(0, "2");
		privacy.board[50] = P(1, "?");
		privacy.board[61] = P(0, "5");
		int[] before = AutoSelectionPolicy.Candidates(privacy);
		foreach (string hidden in new[]
		{
			"F",
			"B",
			"10",
			"1",
			null
		}

		)
		{
			privacy.board[50].rank = hidden;
			if (!before.SequenceEqual(AutoSelectionPolicy.Candidates(privacy)))
				throw new Exception("opponent rank influenced policy");
		}

		var fresh = new MatchView
		{
			side = 0
		};
		fresh.board[60] = P(0, "2");
		fresh.board[61] = P(0, "1");
		First(fresh, 61, "fresh match has no inherited lineage");
		if (!AutoSelectionPolicy.Candidates(moved).SequenceEqual(AutoSelectionPolicy.Candidates(moved)))
			throw new Exception("reconnect reconstruction must be deterministic");
		Console.WriteLine("PASS own identity, capture/blocked fallback, both orientations, repetition, privacy and fresh reconstruction");
	}
}
