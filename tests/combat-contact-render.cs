using System;using System.IO;using UnityEngine;using UnityEditor;using UnityEditor.SceneManagement;
public static class CombatContactRender {
 public static void Render(){ShaderUtil.allowAsyncCompilation=false;EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Directory.CreateDirectory("Logs/CombatContact");
  string[] attackers={"6","4","3","2","1","4"},defenders={"4","4","B","B","10","F"};int[] outcomes={1,0,1,-1,1,1};
  for(int side=0;side<2;side++)for(int c=0;c<attackers.Length;c++){
   var g=new GameObject("Isolated combat");var stage=g.AddComponent<TabletopBoard>();var e=new Dispatch{side=side,attacker=attackers[c],defender=defenders[c],outcome=outcomes[c],kind="combat"};
   foreach(float t in new[]{.5f,.75f,1f}){var rt=(RenderTexture)stage.Battle(e,t);stage.Flush();RenderTexture.active=rt;var image=new Texture2D(rt.width,rt.height,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,rt.width,rt.height),0,0);image.Apply();File.WriteAllBytes("Logs/CombatContact/side"+side+"-"+attackers[c]+"-"+defenders[c]+"-"+t.ToString("F2")+".png",image.EncodeToPNG());UnityEngine.Object.DestroyImmediate(image);RenderTexture.active=null;}
   UnityEngine.Object.DestroyImmediate(g);
  }Debug.Log("COMBAT_CONTACT_RENDER_COMPLETE: 36 impact/topple/final renders");
 }
}
