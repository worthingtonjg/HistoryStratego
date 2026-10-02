// Manual gestures and readable-time expiry share one submission gate.
public sealed class CombatClickGate
{
	string identity;
	bool armed, submitted;
	public void Observe(string current, bool eligible)
	{
		if (identity != current)
		{
			identity = current;
			armed = false;
			submitted = false;
		}

		if (!eligible)
			armed = false;
	}

	public void Press(int clickCount, bool eligible)
	{
		armed = eligible && clickCount == 1 && !submitted;
	}

	public bool Release(bool eligible)
	{
		bool advance = armed && eligible && !submitted;
		armed = false;
		if (advance)
			submitted = true;
		return advance;
	}

	public bool AutoAdvance(bool eligible)
	{
		if (!eligible || submitted)
			return false;
		armed = false;
		submitted = true;
		return true;
	}

	public void Retry()
	{
		submitted = false;
		armed = false;
	}
}
