// Pure transition detector: polling, selection and pause/resume never create turns.
public sealed class TurnNotice
{
	string match;
	int previousTurn;
	bool setup, pending;
	public bool Observe(string id, int side, int turn, string phase, bool actionable)
	{
		if (string.IsNullOrEmpty(id))
		{
			match = null;
			pending = false;
			return false;
		}

		if (match != id)
		{
			match = id;
			previousTurn = turn;
			setup = phase == "setup";
			pending = false;
			return false;
		}

		if (phase == "setup")
		{
			setup = true;
			previousTurn = turn;
			return false;
		}

		if (phase != "play")
		{
			pending = false;
			previousTurn = turn;
			return false;
		}

		if (setup || previousTurn != turn)
		{
			pending = turn == side;
			setup = false;
			previousTurn = turn;
		}

		if (pending && actionable)
		{
			pending = false;
			return true;
		}

		return false;
	}
}
