using UnrealBuildTool;

public class TierraDeNadieTarget : TargetRules
{
	public TierraDeNadieTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TierraDeNadie");
	}
}
