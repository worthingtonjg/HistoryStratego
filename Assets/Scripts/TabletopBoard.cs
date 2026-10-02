using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

// Cached board renders at most 12 Hz for subtle lake ripples; moves render immediately.
public class TabletopBoard : MonoBehaviour
{
	public const float BoardHalfHeight = 4.0f;
	int Layer = 30;
	Camera view;
	RenderTexture target;
	GameObject root;
	readonly GameObject[] pieces = new GameObject[100];
	readonly Renderer[] tiles = new Renderer[100], bodies = new Renderer[100], stickers = new Renderer[100];
	readonly TextMesh[] numbers = new TextMesh[100];
	readonly Dictionary<string, Material> mats = new Dictionary<string, Material>();
	string signature = "";
	Font font;
	bool dirty;
	float lastWaterFrame, lastRequested;
	bool animatedWater;
	readonly List<Texture2D> textures = new List<Texture2D>();
	public static bool Lake(int i)
	{
		return i == 42 || i == 43 || i == 46 || i == 47 || i == 52 || i == 53 || i == 56 || i == 57;
	}

	Material Mat(string key, Color c)
	{
		if (mats.TryGetValue(key, out var m))
			return m;
		m = new Material(Resources.Load<Shader>("Tabletop"));
		m.color = c;
		mats[key] = m;
		return m;
	}

	GameObject Box(string name, Vector3 pos, Vector3 size, Material mat, Transform parent, int cell = -1)
	{
		var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
		g.name = name;
		g.layer = Layer;
		g.transform.SetParent(parent, false);
		g.transform.localPosition = pos;
		g.transform.localScale = size;
		g.GetComponent<Renderer>().sharedMaterial = mat;
		g.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;
		if (cell >= 0)
			g.AddComponent<TabletopCell>().index = cell;
		else
			DestroyImmediate(g.GetComponent<Collider>());
		return g;
	}

	public void Init()
	{
		if (view)
			return;
		RenderSettings.ambientMode = AmbientMode.Flat;
		RenderSettings.ambientLight = new Color(.42f, .42f, .42f);
		root = new GameObject("Tabletop geometry");
		root.transform.SetParent(transform, false);
		root.layer = Layer;
		font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
		var cameraObject = new GameObject("Cached tabletop camera");
		cameraObject.transform.SetParent(transform, false);
		view = cameraObject.AddComponent<Camera>();
		view.enabled = false;
		view.cullingMask = 1 << Layer;
		view.clearFlags = CameraClearFlags.SolidColor;
		view.backgroundColor = new Color(.025f, .04f, .05f);
		view.orthographic = false;
		view.fieldOfView = 30;
		view.orthographicSize = BoardHalfHeight;
		view.nearClipPlane = .1f;
		view.farClipPlane = 150;
		view.transform.position = new Vector3(0, 14, -13);
		view.transform.LookAt(new Vector3(0, .15f, 0));
		var sun = new GameObject("Tabletop soft light");
		sun.transform.SetParent(transform, false);
		var light = sun.AddComponent<Light>();
		light.type = LightType.Directional;
		light.intensity = .85f;
		light.shadows = LightShadows.None;
		light.cullingMask = 1 << Layer;
		sun.transform.rotation = Quaternion.Euler(48, -30, 0);
		Box("Wooden tabletop", new Vector3(0, -.13f, 0), new Vector3(10.18f, .18f, 10.18f), Mat("wood", new Color(.27f, .16f, .085f)), root.transform);
		Box("Dark grid", new Vector3(0, -.015f, 0), new Vector3(10.08f, .08f, 10.08f), Mat("grid", new Color(.18f, .22f, .13f)), root.transform);
		for (int i = 0; i < 100; i++)
		{
			bool upright = Layer == 29;
			var pos = Position(i);
			tiles[i] = Box("Square " + i, pos, new Vector3(.975f, .055f, .975f), Ground(i), root.transform, i).GetComponent<Renderer>();
			var g = new GameObject("Piece " + i);
			g.layer = Layer;
			g.transform.SetParent(root.transform, false);
			g.transform.localPosition = pos;
			pieces[i] = g;
			Box("Foot", upright ? new Vector3(0,.10f,0) : new Vector3(.014f, .064f, -.016f), upright ? new Vector3(BattleMotion.BaseWidth,.14f,.4f) : new Vector3(.87f, .018f, .87f), Mat("rim", new Color(.12f, .15f, .17f)), g.transform, i);
			bodies[i] = Box("Upright block", upright ? new Vector3(0,.52f,0) : new Vector3(0, .181f, 0), upright ? new Vector3(.69f,.8f,.11f) : new Vector3(.84f, .22f, .84f), Mat("red", new Color(.45f, .115f, .105f)), g.transform, i).GetComponent<Renderer>();
			stickers[i] = Box("Illustrated face", upright ? new Vector3(0,.52f,-.06f) : new Vector3(0, .299f, 0), upright ? new Vector3(.59f,.69f,.014f) : new Vector3(.80f, .80f, .012f), Mat("paper", new Color(.91f, .87f, .73f)), g.transform).GetComponent<Renderer>();
			stickers[i].transform.localRotation = Quaternion.Euler(upright ? 0 : 90, 0, 0);
			var label = new GameObject("Rank");
			label.layer = Layer;
			label.transform.SetParent(g.transform, false);
			label.transform.localPosition = upright ? new Vector3(-.29f,.89f,-.086f) : new Vector3(-.365f, .31f, .355f);
			label.transform.localRotation = Quaternion.Euler(upright ? 0 : 90, 0, 0);
			var text = label.AddComponent<TextMesh>();
			text.font = font;
			text.fontSize = 128;
			text.characterSize = .024f;
			text.anchor = TextAnchor.UpperLeft;
			text.alignment = TextAlignment.Left;
			text.color = Color.black;
			text.fontStyle = FontStyle.Bold;
			label.GetComponent<Renderer>().sharedMaterial = font.material;
			numbers[i] = text;
			g.SetActive(false);
		}
		CreateGridLines();
	}

    int fitWidth, fitHeight;
    Mesh gridMesh;
    void CreateGridLines() {
        var vertices = new List<Vector3>(); var indices = new List<int>();
        Action<float,float,float,float> quad = (x,z,w,h) => {
            int n=vertices.Count;
            vertices.Add(new Vector3(x-w/2,.059f,z-h/2)); vertices.Add(new Vector3(x-w/2,.059f,z+h/2));
            vertices.Add(new Vector3(x+w/2,.059f,z+h/2)); vertices.Add(new Vector3(x+w/2,.059f,z-h/2));
            indices.AddRange(new[]{n,n+1,n+2,n,n+2,n+3});
        };
        for(int i=0;i<=10;i++){quad(i-5,0,.018f,10);quad(0,i-5,10,.028f);}
        gridMesh=new Mesh();gridMesh.name="Board grid overlay";gridMesh.SetVertices(vertices);gridMesh.SetTriangles(indices,0);gridMesh.RecalculateNormals();
        var g=new GameObject("Readable grid lines");g.layer=Layer;g.transform.SetParent(root.transform,false);
        g.AddComponent<MeshFilter>().sharedMesh=gridMesh;var renderer=g.AddComponent<MeshRenderer>();
        var mat=Mat("grid-lines",new Color(.07f,.10f,.055f));mat.SetFloat("_Unlit",1);renderer.sharedMaterial=mat;renderer.shadowCastingMode=ShadowCastingMode.Off;
    }
    void FitPerspective(int width,int height) {
        fitWidth=width;fitHeight=height;view.aspect=(float)width/height;view.orthographic=false;view.fieldOfView=30;view.ResetProjectionMatrix();
        Vector3 aim=new Vector3(0,.15f,0), direction=new Vector3(0,.70710678f,-.70710678f);
        float lo=10,hi=100;
        for(int step=0;step<18;step++) {
            float d=(lo+hi)/2;view.transform.position=aim+direction*d;view.transform.LookAt(aim);bool fits=true;
            foreach(float x in new[]{-5.1f,5.1f})foreach(float z in new[]{-5.1f,5.1f})foreach(float y in new[]{-.22f,.36f}) {
                Vector3 p=view.WorldToViewportPoint(new Vector3(x,y,z));if(p.z<=0||p.x<.035f||p.x>.965f||p.y<.035f||p.y>.965f)fits=false;
            }
            if(fits)hi=d;else lo=d;
        }
        view.transform.position=aim+direction*hi;view.transform.LookAt(aim);
        float min=1,max=0;
        foreach(float x in new[]{-5.1f,5.1f})foreach(float z in new[]{-5.1f,5.1f})foreach(float y in new[]{-.22f,.36f}) {
            float v=view.WorldToViewportPoint(new Vector3(x,y,z)).y;min=Mathf.Min(min,v);max=Mathf.Max(max,v);
        }
        var projection=view.projectionMatrix;projection.m12-=2*(.5f-(min+max)/2);view.projectionMatrix=projection;dirty=true;
    }

	public static Vector3 Position(int screen)
	{
		return new Vector3(screen % 10 - 4.5f, .025f, 4.5f - screen / 10);
	}

	Material Ground(int i)
	{
		string key = "ground-" + i;
		if (mats.TryGetValue(key, out var material))
			return material;
		const int resolution = 64;
        var t = new Texture2D(resolution, resolution, TextureFormat.RGBA32, false);
        textures.Add(t);
        var pixels = new Color[resolution * resolution];
        for (int y = 0; y < resolution; y++) for (int x = 0; x < resolution; x++) {
            float gx = (i % 10) * 128 + x * 2, gy = (i / 10) * 128 + y * 2;
            float broad = Mathf.PerlinNoise(gx / 135f, gy / 135f), patch = Mathf.PerlinNoise(gx / 33f + 19, gy / 33f + 5), fine = Mathf.PerlinNoise(gx * .62f, gy * .62f);
            Color c = Color.Lerp(new Color(.24f, .34f, .16f), new Color(.43f, .51f, .28f), broad);
            c = Color.Lerp(c, new Color(.48f, .42f, .27f), Mathf.SmoothStep(.52f, .85f, patch) * .48f);
            c *= .83f + fine * .34f;
            if (Lake(i)) c = Color.Lerp(new Color(.16f,.31f,.35f), new Color(.25f,.43f,.45f), broad);
            pixels[y * resolution + x] = c;
        }

		t.SetPixels(pixels);
		t.Apply();
		t.filterMode = FilterMode.Bilinear;
		var water = Lake(i) ? Resources.Load<Shader>("LakeWater") : null;
		bool ripples = water != null && water.isSupported;
		material = new Material(ripples ? water : Resources.Load<Shader>("Tabletop"));
		animatedWater |= ripples;
		material.mainTexture = t;
		material.SetFloat("_Unlit", 1);
		mats[key] = material;
		return material;
	}

	Material Face(string rank, int side)
	{
		string key = "face-" + rank + "-" + side;
		if (mats.TryGetValue(key, out var m))
			return m;
        if (rank == "?") {
            var concealedShader = Resources.Load<Shader>("PieceFace");
            if (concealedShader != null && concealedShader.isSupported) {
                m = new Material(concealedShader); m.SetFloat("_Concealed", 1);
                m.SetColor("_Backing", side == 0 ? new Color(.72f,.28f,.25f) : new Color(.50f,.68f,.79f));
                mats[key] = m; return m;
            }
        }
		var keyPath = PieceArtResources.Key(rank);
		var art = keyPath == null ? null : Resources.Load<Texture2D>(keyPath);
		var artShader = art != null ? Resources.Load<Shader>("PieceFace") : null;
		if (artShader != null && artShader.isSupported)
		{
			m = new Material(artShader);
			art.wrapMode = TextureWrapMode.Clamp;
			m.mainTexture = art;
			if (Layer == 29) { m.SetFloat("_ArtLeft",.11f);m.SetFloat("_ArtWidth",.78f);m.SetFloat("_ArtHeight",.72f);m.SetFloat("_ArtBottom",rank == "B" || rank == "F" ? .14f : .015f); }
			m.SetColor("_Backing", side == 0 ? new Color(.72f, .28f, .25f) : new Color(.50f, .68f, .79f));
			mats[key] = m;
			return m;
		}

		var t = new Texture2D(128, 160, TextureFormat.RGBA32, false);
		textures.Add(t);
		var bg = rank == "?" ? (side == 0 ? new Color(.38f, .13f, .12f) : new Color(.10f, .23f, .34f)) : new Color(.93f, .89f, .76f);
		var ink = rank == "?" ? new Color(.75f, .72f, .6f) : new Color(.14f, .20f, .22f);
		if (rank == "B")
			ink = new Color(.70f, .08f, .06f);
		else if (rank == "F")
			ink = new Color(.07f, .42f, .15f);
		var pixels = new Color[128 * 160];
		for (int i = 0; i < pixels.Length; i++)
			pixels[i] = bg;
		Action<int, int, Color> dot = (x, y, c) =>
		{
			if (x >= 0 && x < 128 && y >= 0 && y < 160)
				pixels[y * 128 + x] = c;
		};
		Action<int, int, int, int> rect = (x, y, w, h) =>
		{
			for (int a = x; a < x + w; a++)
				for (int b = y; b < y + h; b++)
					dot(a, b, ink);
		};
		Action<int, int, int> circle = (x, y, r) =>
		{
			for (int a = -r; a <= r; a++)
				for (int b = -r; b <= r; b++)
					if (a * a + b * b <= r * r)
						dot(x + a, y + b, ink);
		};
		if (rank == "?")
		{
			rect(26, 27, 76, 3);
			rect(26, 83, 76, 3);
			rect(62, 36, 4, 39);
			rect(46, 52, 36, 4);
		}
		else if (rank == "F")
		{
			rect(39, 23, 5, 66);
			for (int x = 44; x < 95; x++)
				for (int y = 65; y < 91 - (x - 44) / 3; y++)
					dot(x, y, ink);
		}
		else if (rank == "B")
		{
			circle(62, 48, 25);
			rect(57, 70, 11, 12);
			rect(66, 82, 16, 4);
			circle(85, 85, 4);
		}
		else if (rank == "3")
		{
			rect(60, 20, 7, 67);
			for (int x = 28; x < 99; x++)
				rect(x, 78 - Math.Abs(x - 64) / 5, 2, 7);
		}
		else if (rank == "2")
		{
			circle(43, 52, 17);
			circle(85, 52, 17);
			rect(43, 45, 42, 16);
			rect(35, 69, 16, 19);
			rect(77, 69, 16, 19);
		}
		else if (rank == "1")
		{
			circle(64, 64, 18);
			rect(31, 75, 66, 7);
			rect(45, 78, 38, 15);
			rect(43, 24, 42, 26);
		}
		else
		{
			circle(64, 66, 18);
			rect(43, 76, 42, 10);
			rect(36, 74, 54, 4);
			for (int y = 20; y < 48; y++)
				rect(30 + (y - 20) / 3, y, 68 - 2 * ((y - 20) / 3), 1);
			rect(61, 23, 6, 25);
			circle(45, 33, 3);
			circle(83, 33, 3);
		}

		for (int y = 0; y < 80; y++)
			for (int x = 0; x < 128; x++)
			{
				int a = y * 128 + x, b = (159 - y) * 128 + x;
				var c = pixels[a];
				pixels[a] = pixels[b];
				pixels[b] = c;
			}

		t.SetPixels(pixels);
		t.Apply();
		t.filterMode = FilterMode.Bilinear;
		m = new Material(Resources.Load<Shader>("Tabletop"));
		m.mainTexture = t;
		m.SetFloat("_Unlit", 1);
		mats[key] = m;
		return m;
	}

	public bool HasGeneratedArt(string rank)
	{
		var key = PieceArtResources.Key(rank);
		return key != null && Resources.Load<Texture2D>(key) != null;
	}

	public Texture DetailArt(string rank, int side)
	{
		Init();
		return Face(rank, side).mainTexture;
	}

	public Texture Render(PieceView[] board, int rotate, int selected, bool[] legal, int from, int to, int width, int height)
	{
		Init();
		lastRequested = Time.unscaledTime;
		width = Mathf.Clamp(width, 400, 1400);
		height = Mathf.Clamp(height, 300, 1050);
		if (Layer == 30 && (fitWidth != width || fitHeight != height)) FitPerspective(width, height);
		if (!target || target.width != width || target.height != height)
		{
			if (target)
			{
				target.Release();
				DestroyImmediate(target);
			}

			target = new RenderTexture(width, height, 16);
			var descriptor = target.descriptor;
			descriptor.msaaSamples = 4;
			target.antiAliasing = SystemInfo.GetRenderTextureSupportedMSAASampleCount(descriptor);
			target.filterMode = FilterMode.Bilinear;
			target.Create();
			view.targetTexture = target;
			signature = "";
		}

		var key = new System.Text.StringBuilder().Append(rotate).Append(':').Append(selected).Append(':').Append(from).Append(':').Append(to);
		for (int i = 0; i < 100; i++)
		{
			var p = board[i];
			key.Append(p == null ? "_" : p.side + p.rank);
			key.Append(legal != null && legal[i] ? 'L' : '-');
		}

		if (key.ToString() != signature)
		{
			signature = key.ToString();
			for (int screen = 0; screen < 100; screen++)
			{
				int i = rotate == 0 ? screen : 99 - screen;
				var p = board[i];
				pieces[screen].transform.localPosition = Position(screen);
				pieces[screen].transform.localRotation = Quaternion.identity;
				pieces[screen].SetActive(p != null);
				tiles[screen].sharedMaterial = i == selected ? Mat("selected", new Color(1, .67f, .16f)) : i == to ? Mat("arrival", new Color(.47f, .78f, .62f)) : i == from ? Mat("departure", new Color(.81f, .65f, .38f)) : legal != null && legal[i] ? p != null ? Mat("attack", new Color(.95f, .39f, .18f)) : Mat("legal", new Color(.51f, .74f, .55f)) : Ground(screen);
				if (p == null)
					continue;
				bodies[screen].sharedMaterial = p.side == 0 ? Mat("red", new Color(.45f, .115f, .105f)) : Mat("blue", new Color(.13f, .29f, .43f));
				stickers[screen].sharedMaterial = Face(p.rank, p.side);
				int numericRank;
				bool numbered = int.TryParse(p.rank, out numericRank) && numericRank >= 1 && numericRank <= 10;
				numbers[screen].text = numbered || p.rank == "B" || p.rank == "F" ? p.rank : "";
			}

			view.aspect = (float)width / height;
			dirty = true;
		}

		return target;
	}

	public void AnimateMove(int from, int to, int rotate, float progress)
	{
		int a = rotate == 0 ? from : 99 - from, b = rotate == 0 ? to : 99 - to;
		pieces[a].transform.localPosition = Vector3.Lerp(Position(a), Position(b), Mathf.SmoothStep(0, 1, progress));
		dirty = true;
	}

	public void InvalidatePositions() { signature = ""; }
	public void AnimateSwap(int from, int to, int rotate, float progress)
	{
		int a = rotate == 0 ? from : 99 - from, b = rotate == 0 ? to : 99 - to;
		float t = Mathf.SmoothStep(0, 1, Mathf.Clamp01(progress));
		Vector3 offset = Vector3.Cross((Position(b) - Position(a)).normalized, Vector3.up) * (.25f * Mathf.Sin(Mathf.PI * t));
		pieces[a].transform.localPosition = Vector3.Lerp(Position(a), Position(b), t) + offset;
		pieces[b].transform.localPosition = Vector3.Lerp(Position(b), Position(a), t) - offset;
		dirty = true;
	}
	float battleFrame = -1;
	public Texture Battle(Dispatch e, float progress)
	{
		Layer = 29;
		var board = new PieceView[100];
		board[90] = new PieceView
		{
			side = e.side,
			rank = e.attacker
		};
		board[99] = new PieceView
		{
			side = 1 - e.side,
			rank = e.defender
		};
		var texture = Render(board, 0, -1, null, -1, -1, 1100, 540);
		if (Mathf.Approximately(battleFrame, progress))
			return texture;
		battleFrame = progress;
		foreach (var tile in tiles)
			tile.gameObject.SetActive(false);
		root.transform.Find("Wooden tabletop").gameObject.SetActive(false);
		root.transform.Find("Dark grid").gameObject.SetActive(false);
		root.transform.Find("Readable grid lines").gameObject.SetActive(false);
		view.orthographic = true;
		view.ResetProjectionMatrix();
		view.transform.position = new Vector3(0, 1.9f, -5);
		view.transform.LookAt(new Vector3(0, .55f, 0));
		view.orthographicSize = 1.35f;
		var pose = BattleMotion.At(e.attacker, e.outcome, progress);
		pieces[90].transform.localPosition = new Vector3(pose.attackerX, .025f, 0);
		pieces[99].transform.localPosition = new Vector3(pose.defenderX, .025f, 0);
		pieces[90].transform.localRotation = Quaternion.Euler(0, 0, pose.attackerFall);
		pieces[99].transform.localRotation = Quaternion.Euler(0, 0, pose.defenderFall);
		dirty = true;
		return texture;
	}

	public void Flush()
	{
		if (dirty && view && target)
		{
			view.Render();
			dirty = false;
		}
	}

	void LateUpdate()
	{
		if (Layer == 30 && animatedWater && Time.unscaledTime - lastRequested < .5f && Time.unscaledTime - lastWaterFrame >= 1f / 12f)
		{
			dirty = true;
			lastWaterFrame = Time.unscaledTime;
		}

		Flush();
	}

	public int Pick(Vector2 uv, int rotate)
	{
		Physics.SyncTransforms();
		var ray = view.ViewportPointToRay(new Vector3(uv.x, uv.y, 0));
		if (Physics.Raycast(ray, out var hit, 100, 1 << Layer))
		{
			var c = hit.collider.GetComponent<TabletopCell>();
			if (c)
				return rotate == 0 ? c.index : 99 - c.index;
		}

		return -1;
	}

	public Vector2 Project(int canonical, int rotate)
	{
		int n = rotate == 0 ? canonical : 99 - canonical;
		return view.WorldToViewportPoint(Position(n) + Vector3.up * .3f);
	}

	void OnDestroy()
	{
		if (gridMesh) DestroyImmediate(gridMesh);
		if (target)
		{
			target.Release();
			DestroyImmediate(target);
		}

		foreach (var t in textures)
			DestroyImmediate(t);
		foreach (var m in mats.Values)
			DestroyImmediate(m);
	}
}

public class TabletopCell : MonoBehaviour
{
	public int index;
}
