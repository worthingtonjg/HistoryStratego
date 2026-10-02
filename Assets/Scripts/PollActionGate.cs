public sealed class PollActionGate<T>
	where T : class
{
	public bool Active { get; private set; }
	public bool Reading { get; private set; }
	public T Pending { get; private set; }

	public bool BlocksInput
	{
		get
		{
			return (Active && !Reading) || Pending != null;
		}
	}

	public void Begin(bool reading)
	{
		Active = true;
		Reading = reading;
	}

	public void Complete()
	{
		Active = false;
		Reading = false;
	}

	public bool Enqueue(T value)
	{
		if (!Active || !Reading || Pending != null)
			return false;
		Pending = value;
		return true;
	}

	public T Take()
	{
		var value = Pending;
		Pending = null;
		return value;
	}
}
