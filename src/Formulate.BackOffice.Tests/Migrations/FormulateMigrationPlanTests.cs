using Formulate.BackOffice.Migrations;
using Umbraco.Cms.Infrastructure.Migrations;
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
    public void A_new_install_grants_the_section_then_moves_Formulate_3_permissions()
    {
        var plan = new FormulateMigrationPlan();

        var (steps, end) = Walk(plan, string.Empty);

        Assert.Equal(new[] { typeof(GrantSectionToAdministrators), typeof(MoveFormulate3SectionPermissions) }, steps);
        Assert.Equal(plan.FinalState, end);
    }

    [Fact]
    public void A_site_upgraded_from_Formulate_3_runs_each_step_once()
    {
        // Formulate 3 (Umbraco 8) ran its own plan named "Formulate", which ended at "state-1".
        var plan = new FormulateMigrationPlan();

        var (steps, end) = Walk(plan, "state-1");

        Assert.Equal(new[] { typeof(GrantSectionToAdministrators), typeof(MoveFormulate3SectionPermissions) }, steps);
        Assert.Equal(plan.FinalState, end);
    }

    [Fact]
    public void A_site_that_already_granted_the_section_moves_Formulate_3_permissions()
    {
        var plan = new FormulateMigrationPlan();

        var (steps, end) = Walk(plan, "formulate-5-section-granted");

        Assert.Equal(new[] { typeof(MoveFormulate3SectionPermissions) }, steps);
        Assert.Equal(plan.FinalState, end);
    }

    /// <summary>
    /// Follows the plan from a stored state, as Umbraco does, until no step is left.
    /// </summary>
    private static (List<Type> Steps, string End) Walk(MigrationPlan plan, string state)
    {
        var steps = new List<Type>();
        while (plan.Transitions.TryGetValue(state, out var transition) && transition is not null)
        {
            steps.Add(transition.MigrationType);
            state = transition.TargetState;
            Assert.True(steps.Count <= plan.Transitions.Count, "The plan has a loop.");
        }

        return (steps, state);
    }
}
