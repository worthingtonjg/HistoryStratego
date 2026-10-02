using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEditor;
using UnityEngine;

// The chosen plaintext key is local build input only. Never log it or serialize it into assets.
public sealed class TeacherGateBuildConfig : IDisposable
{
	const string AssetPath = "Assets/Resources/TeacherGateBuild.json";
	[Serializable]
	class Verifier
	{
		public string salt, digest;
	}

	public static TeacherGateBuildConfig Prepare()
	{
		string path = Path.Combine(Directory.GetCurrentDirectory(), "LocalConfig", "teacher-key.txt");
		if (!File.Exists(path))
			throw new InvalidOperationException("Teacher key setup required: save your chosen key in LocalConfig/teacher-key.txt.");
		string key = File.ReadAllText(path).TrimEnd('\r', '\n');
		if (key.Length < 8)
			throw new InvalidOperationException("Teacher key setup required: enter at least 8 characters in LocalConfig/teacher-key.txt.");
		if (File.Exists(AssetPath))
			throw new InvalidOperationException("A generated teacher verifier already exists; inspect it before rebuilding.");
		var bytes = new byte[32];
		using (var rng = RandomNumberGenerator.Create())
			rng.GetBytes(bytes);
		string salt = Convert.ToBase64String(bytes), digest;
		using (var sha = SHA256.Create())
			digest = Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(salt + "\n" + key)));
		Directory.CreateDirectory("Assets/Resources");
		File.WriteAllText(AssetPath, JsonUtility.ToJson(new Verifier { salt = salt, digest = digest }));
		AssetDatabase.ImportAsset(AssetPath, ImportAssetOptions.ForceSynchronousImport);
		return new TeacherGateBuildConfig();
	}

	public void Dispose()
	{
		AssetDatabase.DeleteAsset(AssetPath);
	}
}
