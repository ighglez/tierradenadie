using UnrealBuildTool;

public class TierraDeNadieEditorTarget : TargetRules
{
	public TierraDeNadieEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TierraDeNadie");
	}
}
