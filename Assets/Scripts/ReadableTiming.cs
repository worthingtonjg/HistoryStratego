using System;

// Receives only foreground, visible elapsed seconds; never owns moves or teacher controls.
public sealed class ReadableTiming
{
	string identity;
	public float Elapsed { get; private set; }

	public void Observe(string key, bool eligible, float seconds)
	{
		if (identity != key)
		{
			identity = key;
			Elapsed = 0;
		}

		if (key != null && eligible && seconds > 0 && !float.IsInfinity(seconds) && !float.IsNaN(seconds))
			Elapsed += seconds;
	}

	public void Retry()
	{
		Elapsed = 0;
	}

	public bool InWindow(float start, float duration)
	{
		return Elapsed >= start && Elapsed < start + duration;
	}

	public static string Reminder(string key)
	{
		string[] lines =
		{
			"Your troops are ready. Their commander appears to be buffering.",
			"The scouts have returned. They are politely waiting for a plan.",
			"Your army has finished its imaginary tea break. Your move!",
			"A strategic pause is fine. The map is ready when you are."
		};
		uint hash = 2166136261;
		foreach (char c in key ?? "")
		{
			hash ^= c;
			hash *= 16777619;
		}

		return lines[hash % (uint)lines.Length] + "\n- Take your turn dummy!";
	}
}
