using Formulate.BackOffice.Migrations;
using Xunit;

namespace Formulate.BackOffice.Tests.Migrations;

public sealed class FormulateMigrationPlanTests
{
    [Fact]
    public void Plan_is_named_Formulate()
    {
        var plan = new FormulateMigrationPlan();

        Assert.Equal("Formulate", plan.Name);
        Assert.Equal("Formulate", plan.PackageName);
    }

    [Fact]
    public void A_new_install_grants_the_section()
    {
        var plan = new FormulateMigrationPlan();

        var transition = plan.Transitions[string.Empty];

        Assert.Equal(typeof(GrantSectionToAdministrators), transition?.MigrationType);
        Assert.Equal(plan.FinalState, transition?.TargetState);
    }

    [Fact]
    public void A_site_upgraded_from_Formulate_3_grants_the_section()
    {
        // Formulate 3 (Umbraco 8) ran its own plan named "Formulate", which ended at "state-1".
        var plan = new FormulateMigrationPlan();

        var transition = plan.Transitions["state-1"];

        Assert.Equal(typeof(GrantSectionToAdministrators), transition?.MigrationType);
        Assert.Equal(plan.FinalState, transition?.TargetState);
    }
}
