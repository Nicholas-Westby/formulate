using Formulate.BackOffice.Api;
using Formulate.BackOffice.Api.Models.Tree;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Definitions.Forms;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.Configuration;
using Formulate.Core.DataValues;
using Formulate.Core.DataValues.Legacy;
using Formulate.Core.DataValues.List;
using Formulate.Core.DataValues.PairList;
using Formulate.Core.Folders;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Validations;
using Formulate.Core.Validations.Mandatory;
using Formulate.Core.Validations.Regex;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using ApiEntityTypes = Formulate.BackOffice.Api.EntityTypes;

namespace Formulate.BackOffice.Tests.Api;

public class CreateOptionsApiServiceTests
{
    private readonly RepositoryHarness _harness = new();
    private readonly FakeTreeEntityRepository _repository = new();
    private readonly List<ILayoutDefinition> _layouts = new();
    private readonly List<IFormDefinition> _forms = new() { new DefaultFormLayoutDefinition(), new FormWithBasicLayoutDefinition() };

    private CreateOptionsApiService CreateService() => new(
        _repository,
        new FormDefinitionCollection(() => _forms),
        new LayoutDefinitionCollection(() => _layouts),
        new DataValuesDefinitionCollection(() => new IDataValuesDefinition[]
        {
            new PairListDataValuesDefinition(_harness.JsonUtility),
            new LegacyDataValuesDefinition(),
            new ListDataValuesDefinition(_harness.JsonUtility),
        }),
        new ValidationDefinitionCollection(() => new IValidationDefinition[]
        {
            new RegexValidationDefinition(
                _harness.JsonUtility,
                Options.Create(new FormulateSubmissionsOptions()),
                NullLogger<RegexValidation>.Instance),
            new MandatoryValidationDefinition(_harness.JsonUtility),
        }));

    private PersistedFolder AddFolder(Guid root, params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var folder = new PersistedFolder { Id = id, Name = "f", Alias = "f", Path = new[] { root }.Concat(parents).Append(id).ToArray() };
        _repository.Add(folder);
        return folder;
    }

    private PersistedForm AddForm()
    {
        var id = Guid.NewGuid();
        var form = new PersistedForm { Id = id, Name = "form", Alias = "form", Path = new[] { FormConstantsRoot.Forms, id } };
        _repository.Add(form);
        return form;
    }

    private static IReadOnlyList<CreateOptionModel> Ok(ServiceResult<IReadOnlyList<CreateOptionModel>> result)
    {
        Assert.True(result.Status == ServiceStatus.Success, $"{result.Status}: {result.Field} {result.Message}");
        return result.Value!;
    }

    private static ILayoutDefinition Layout(string name, bool legacy = false)
    {
        var layout = new Mock<ILayoutDefinition>();
        layout.SetupGet(x => x.KindId).Returns(Guid.NewGuid());
        layout.SetupGet(x => x.Name).Returns(name);
        layout.SetupGet(x => x.IsLegacy).Returns(legacy);
        return layout.Object;
    }

    [Fact]
    public void Create_options_at_the_forms_root_are_a_folder_and_the_form_kinds()
    {
        var options = Ok(CreateService().GetCreateOptions(TreeAliases.Forms, null));

        Assert.Equal(
            new[] { ("Folder", ApiEntityTypes.FormFolder), ("Form", ApiEntityTypes.Form), ("Form with Basic Layout", ApiEntityTypes.Form) },
            options.Select(x => (x.Name, x.EntityType)));
        Assert.Null(options[0].KindId);
        Assert.Equal(new DefaultFormLayoutDefinition().KindId, options[1].KindId);
        Assert.Equal(new FormWithBasicLayoutDefinition().KindId, options[2].KindId);
        Assert.Equal(new FormWithBasicLayoutDefinition().Description, options[2].Description);
        Assert.Equal(new[] { FormulateIcons.Folder, FormulateIcons.Form, FormulateIcons.Form }, options.Select(x => x.Icon));
    }

    [Fact]
    public void Legacy_form_definitions_are_not_offered()
    {
        var legacy = new Mock<IFormDefinition>();
        legacy.SetupGet(x => x.KindId).Returns(Guid.NewGuid());
        legacy.SetupGet(x => x.Name).Returns("Old form");
        legacy.SetupGet(x => x.IsLegacy).Returns(true);
        legacy.SetupGet(x => x.Description).Returns(string.Empty);
        legacy.SetupGet(x => x.Icon).Returns("icon-document");
        _forms.Add(legacy.Object);

        var options = Ok(CreateService().GetCreateOptions(TreeAliases.Forms, null));

        Assert.DoesNotContain(options, x => x.Name == "Old form");
        Assert.Equal(3, options.Count);
    }

    [Fact]
    public void Create_options_in_a_forms_folder_match_the_root()
    {
        var folder = AddFolder(FormConstantsRoot.Forms);

        var options = Ok(CreateService().GetCreateOptions(TreeAliases.Forms, folder.Id));

        Assert.Equal(3, options.Count);
        Assert.Equal(ApiEntityTypes.FormFolder, options[0].EntityType);
    }

    [Fact]
    public void Naming_the_tree_root_is_the_same_as_leaving_the_parent_out()
    {
        var service = CreateService();

        Assert.Equal(
            Ok(service.GetCreateOptions(TreeAliases.Validations, null)).Select(x => x.Name),
            Ok(service.GetCreateOptions(TreeAliases.Validations, FormConstantsRoot.Validations)).Select(x => x.Name));
    }

    [Fact]
    public void Create_options_under_form_are_layout_kinds()
    {
        _layouts.Add(Layout("Zebra layout"));
        _layouts.Add(Layout("alpha layout"));
        var form = AddForm();

        var options = Ok(CreateService().GetCreateOptions(TreeAliases.Forms, form.Id));

        Assert.Equal(new[] { "alpha layout", "Zebra layout" }, options.Select(x => x.Name));
        Assert.All(options, option =>
        {
            Assert.Equal(ApiEntityTypes.Layout, option.EntityType);
            Assert.NotNull(option.KindId);
            Assert.Equal(FormulateIcons.Layout, option.Icon);
        });
    }

    [Fact]
    public void Legacy_kinds_are_not_offered()
    {
        _layouts.Add(Layout("Current"));
        _layouts.Add(Layout("Old", legacy: true));
        var form = AddForm();
        var service = CreateService();

        Assert.Equal(new[] { "Current" }, Ok(service.GetCreateOptions(TreeAliases.Forms, form.Id)).Select(x => x.Name));
        Assert.DoesNotContain(Ok(service.GetCreateOptions(TreeAliases.DataValues, null)), x => x.KindId == Guid.Parse(LegacyDataValuesDefinition.Constants.KindId));
    }

    [Fact]
    public void Data_values_root_offers_a_folder_then_kinds_sorted_by_name()
    {
        var options = Ok(CreateService().GetCreateOptions(TreeAliases.DataValues, null));

        Assert.Equal(("Folder", ApiEntityTypes.DataValuesFolder), (options[0].Name, options[0].EntityType));
        var kinds = options.Skip(1).ToArray();
        Assert.Equal(new[] { ListDataValuesDefinition.Constants.Name, PairListDataValuesDefinition.Constants.Name }.OrderBy(x => x), kinds.Select(x => x.Name));
        Assert.All(kinds, kind => Assert.Equal(ApiEntityTypes.DataValues, kind.EntityType));
        Assert.All(options, option => Assert.DoesNotContain("icon-formulate-", option.Icon));
    }

    [Fact]
    public void Validations_folder_offers_a_folder_then_kinds_sorted_by_name()
    {
        var folder = AddFolder(FormConstantsRoot.Validations);

        var options = Ok(CreateService().GetCreateOptions(TreeAliases.Validations, folder.Id));

        Assert.Equal(new[] { "Folder", MandatoryValidationDefinition.Constants.Name, RegexValidationDefinition.Constants.Name }, options.Select(x => x.Name));
        Assert.Equal(ApiEntityTypes.ValidationFolder, options[0].EntityType);
        Assert.All(options.Skip(1), option => Assert.Equal((ApiEntityTypes.Validation, FormulateIcons.Validation), (option.EntityType, option.Icon)));
    }

    [Fact]
    public void Layouts_and_items_offer_nothing()
    {
        var form = AddForm();
        var layoutId = Guid.NewGuid();
        _repository.Add(new PersistedLayout { Id = layoutId, Name = "l", Path = form.Path.Append(layoutId).ToArray() });
        var validationId = Guid.NewGuid();
        _repository.Add(new PersistedValidation { Id = validationId, Name = "v", Path = new[] { FormConstantsRoot.Validations, validationId } });
        var dataValuesId = Guid.NewGuid();
        _repository.Add(new PersistedDataValues { Id = dataValuesId, Name = "d", Path = new[] { FormConstantsRoot.DataValues, dataValuesId } });
        var service = CreateService();

        Assert.Empty(Ok(service.GetCreateOptions(TreeAliases.Forms, layoutId)));
        Assert.Empty(Ok(service.GetCreateOptions(TreeAliases.Validations, validationId)));
        Assert.Empty(Ok(service.GetCreateOptions(TreeAliases.DataValues, dataValuesId)));
    }

    [Fact]
    public void An_unknown_tree_is_invalid()
    {
        var result = CreateService().GetCreateOptions("nope", null);

        Assert.Equal((ServiceStatus.Invalid, "treeAlias"), (result.Status, result.Field));
    }

    [Fact]
    public void A_missing_parent_or_a_parent_from_another_tree_is_not_found()
    {
        var folder = AddFolder(FormConstantsRoot.DataValues);
        var service = CreateService();

        Assert.Equal(ServiceStatus.NotFound, service.GetCreateOptions(TreeAliases.Forms, Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.GetCreateOptions(TreeAliases.Validations, folder.Id).Status);
    }
}
