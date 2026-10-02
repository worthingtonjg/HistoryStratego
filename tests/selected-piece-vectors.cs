using System;

public class PieceView
{
	public int side;
	public string rank;
}

public class SelectionView
{
	public int side, seq, from;
}

public class Dispatch
{
	public string kind;
}

public class TurnClockView
{
	public double noticeRemainingMs;
}

public class MatchView
{
	public string id, phase;
	public int side, turn, seq;
	public bool blocked, setupBlocked;
	public Dispatch battle;
	public TurnClockView turnClock;
	public SelectionView selection;
	public PieceView[] board;
}

class SelectedPieceTests
{
	static void Check(bool value, string message)
	{
		if (!value)
			throw new Exception(message);
	}

	static void Main()
	{
		var m = new MatchView
		{
			phase = "play",
			side = 0,
			turn = 0,
			seq = 4,
			board = new PieceView[100],
			selection = new SelectionView
			{
				side = 0,
				seq = 4,
				from = 60
			}
		};
		m.board[60] = new PieceView
		{
			side = 0,
			rank = "10"
		};
		Check(SelectedPieceDetails.Visible(m, "active").rank == "10", "own authoritative selection");
		Check(SelectedPieceDetails.Visible(m, "paused") != null, "paused read-only selection");
		Check(SelectedPieceDetails.Visible(m, "ended") == null, "ended class");
		m.board[60].rank = "?";
		Check(SelectedPieceDetails.Visible(m, "active") == null, "concealed rank");
		m.board[60].rank = "10";
		m.side = 1;
		Check(SelectedPieceDetails.Visible(m, "active") == null, "opposite spectator");
		m.side = 0;
		m.seq++;
		Check(SelectedPieceDetails.Visible(m, "active") == null, "move completed/stale selection");
		m.seq--;
		m.turn = 1;
		Check(SelectedPieceDetails.Visible(m, "active") == null, "turn changed");
		m.turn = 0;
		m.phase = "setup";
		Check(SelectedPieceDetails.Visible(m, "active") == null, "setup panel priority");
		m.phase = "over";
		Check(SelectedPieceDetails.Visible(m, "active") == null, "match ended");
		m.phase = "play";
		m.battle = new Dispatch
		{
			kind = "combat"
		};
		Check(SelectedPieceDetails.Visible(m, "active") == null, "combat priority");
		m.battle = null;
		m.turnClock = new TurnClockView
		{
			noticeRemainingMs = 1000
		};
		Check(SelectedPieceDetails.Visible(m, "active") == null, "notice priority");
		m.turnClock = null;
		m.board[60] = null;
		Check(SelectedPieceDetails.Visible(m, "active") == null, "piece removed");
		m.selection = null;
		Check(SelectedPieceDetails.Visible(m, "active") == null, "deselection/new round");
		foreach (var rank in new[]
		{
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"10",
			"B",
			"F"
		}

		)
			Check(SelectedPieceDetails.Rule(rank).Length > 25 && SelectedPieceDetails.Flavor(rank).Length > 15, "role content");
		m.id = "round-one";
		m.phase = "play";
		m.turn = 0;
		m.seq = 4;
		m.board[60] = new PieceView
		{
			side = 0,
			rank = "B"
		};
		var inspect = new OwnPieceInspection();
		inspect.Toggle(m, 60);
		Check(inspect.Index(m) == 60 && SelectedPieceDetails.Visible(m, "active", 60).rank == "B", "own bomb inspect without move selection");
		Check(m.selection == null, "inspection never creates move targets");
		inspect.Toggle(m, 60);
		Check(inspect.Index(m) == -2, "bomb deselection");
		m.board[61] = new PieceView
		{
			side = 0,
			rank = "F"
		};
		inspect.Toggle(m, 61);
		Check(SelectedPieceDetails.Visible(m, "active", inspect.Index(m)).rank == "F", "own flag inspect");
		inspect.Clear();
		Check(inspect.Index(m) == -1, "switch to movable selection");
		inspect.Toggle(m, 60);
		m.turn = 1;
		Check(inspect.Index(m) == -1, "wrong turn clears inspection");
		Check(SelectedPieceDetails.Visible(m, "active", 60) == null, "wrong turn rejects inspection");
		m.turn = 0;
		inspect.Toggle(m, 60);
		m.seq++;
		Check(inspect.Index(m) == -1, "move clears inspection");
		m.seq--;
		inspect.Toggle(m, 60);
		m.id = "round-two";
		Check(inspect.Index(m) == -1, "new match clears inspection");
		m.board[60].side = 1;
		Check(SelectedPieceDetails.Visible(m, "active", 60) == null, "cannot inspect enemy");
		Console.WriteLine("PASS redacted selection lifecycle and role content");
	}
}
