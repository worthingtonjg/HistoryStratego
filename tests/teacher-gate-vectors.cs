using System;
using System.Security.Cryptography;
using System.Text;

namespace UnityEngine
{
	public class TextAsset
	{
		public string text;
	}

	public static class Resources
	{
		public static TextAsset Asset;
		public static T Load<T>(string name)
			where T : class
		{
			return Asset as T;
		}
	}

	public static class JsonUtility
	{
		public static T FromJson<T>(string text)
		{
			var value = Activator.CreateInstance(typeof(T), true);
			var parts = text.Split('|');
			typeof(T).GetField("salt").SetValue(value, parts[0]);
			typeof(T).GetField("digest").SetValue(value, parts[1]);
			return (T)value;
		}
	}
}

public static class GateVectors
{
	static void Check(bool value)
	{
		if (!value)
			throw new Exception("Gate vector failed");
	}

	public static void Main()
	{
		Check(!TeacherGateVerifier.Accepts("test fixture"));
		string salt = "test-salt", key = "test-only-fixture", hash;
		using (var sha = SHA256.Create())
			hash = Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(salt + "\n" + key)));
		UnityEngine.Resources.Asset = new UnityEngine.TextAsset
		{
			text = salt + "|" + hash
		};
		Check(!TeacherGateVerifier.Accepts(""));
		Check(!TeacherGateVerifier.Accepts("wrong-fixture"));
		Check(TeacherGateVerifier.Accepts(key));
		UnityEngine.Resources.Asset = new UnityEngine.TextAsset
		{
			text = "malformed"
		};
		Check(!TeacherGateVerifier.Accepts(key));
		Console.WriteLine("PASS compiled convenience verifier: absent, empty, wrong, correct, malformed");
	}
}
