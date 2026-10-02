using System;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

// Casual compiled convenience gate, not strong authentication against browser modification.
public static class TeacherGateVerifier
{
	[Serializable]
	class Verifier
	{
		public string salt, digest, rememberId;
	}

	public static string RememberedId()
	{
		var asset = Resources.Load<TextAsset>("TeacherGateBuild");
		if (asset == null)
			return "";
		try
		{
			return JsonUtility.FromJson<Verifier>(asset.text).rememberId ?? "";
		}
		catch
		{
			return "";
		}
	}

	public static bool AcceptsRemembered(string grant)
	{
		string current = RememberedId();
		return current.Length > 0 && !string.IsNullOrEmpty(grant) && grant == current;
	}

	public static bool Accepts(string entered)
	{
		var asset = Resources.Load<TextAsset>("TeacherGateBuild");
		if (asset == null || string.IsNullOrEmpty(entered))
			return false;
		try
		{
			var verifier = JsonUtility.FromJson<Verifier>(asset.text);
			using (var sha = SHA256.Create())
				return Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(verifier.salt + "\n" + entered))) == verifier.digest;
		}
		catch
		{
			return false;
		}
	}
}
