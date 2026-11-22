using Formulate.BackOffice.Api.Models.Definition;
using System.Text.Json;
using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.DataValues;
using Formulate.Core.DataValues.Legacy;
using Formulate.Core.DataValues.List;
using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Button;
using Formulate.Core.FormFields.Text;
using Formulate.Core.FormHandlers;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Templates;
using Formulate.Core.Validations;
using Formulate.Core.Validations.Mandatory;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class DefinitionApiServiceTests
{
    private readonly RepositoryHarness _harness = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();
    private readonly List<IFormFieldDefinition> _fields = new();
    private readonly List<IFormHandlerDefinition> _handlers = new();
    private readonly List<IValidationDefinition> _validations = new();
    private readonly List<IDataValuesDefinition> _dataValues = new();
    private readonly List<ILayoutDefinition> _layouts = new();
    private readonly List<ITemplateDefinition> _templates = new();

    private DefinitionApiService CreateService() => new(
        new FormFieldDefinitionCollection(() => _fields),
        new FormHandlerDefinitionCollection(() => _handlers),
        new ValidationDefinitionCollection(() => _validations),
        new DataValuesDefinitionCollection(() => _dataValues),
        new LayoutDefinitionCollection(() => _layouts),
        new TemplateDefinitionCollection(() => _templates),
        new ConfigurationJson(_harness.JsonUtility, _logger));

    private static IFormFieldDefinition LegacyField()
    {
        var legacy = new Mock<IFormFieldDefinition>();
        legacy.SetupGet(x => x.IsLegacy).Returns(true);
        legacy.SetupGet(x => x.KindId).Returns(Guid.NewGuid());
        legacy.SetupGet(x => x.Name).Returns("Legacy field");
        return legacy.Object;
    }

    private static IFormHandlerDefinition LegacyHandler()
    {
        var legacy = new Mock<IFormHandlerDefinition>();
        legacy.SetupGet(x => x.IsLegacy).Returns(true);
        legacy.SetupGet(x => x.KindId).Returns(Guid.NewGuid());
        legacy.SetupGet(x => x.Name).Returns("Legacy handler");
        return legacy.Object;
    }

    [Fact]
    public void Form_fields_keep_their_kebab_case_editor_alias()
    {
        var button = new ButtonFieldDefinition(_harness.JsonUtility);
        _fields.Add(button);

        var model = Assert.Single(CreateService().GetFormFields());

        Assert.Equal("formulate-button-field", model.EditorAlias);
        Assert.Equal((button.KindId, button.Name, button.Icon, button.Category), (model.KindId, model.Name, model.Icon, model.Category));
    }

    [Theory]
    [InlineData(nameof(FormFieldDefinitionModel.SupportsLabel))]
    [InlineData(nameof(FormFieldDefinitionModel.SupportsValidation))]
    [InlineData(nameof(FormFieldDefinitionModel.SupportsCategory))]
    [InlineData(nameof(FormFieldDefinitionModel.IsServerSideOnly))]
    [InlineData(nameof(FormFieldDefinitionModel.IsStored))]
    [InlineData(nameof(FormFieldDefinitionModel.IsHidden))]
    public void Each_form_field_flag_is_copied_from_its_own_property(string flag)
    {
        var definition = new Mock<IFormFieldDefinition>();
        definition.SetupGet(x => x.KindId).Returns(Guid.NewGuid());
        definition.SetupGet(x => x.Name).Returns("Odd");
        definition.SetupGet(x => x.Icon).Returns("icon-odd");
        definition.SetupGet(x => x.Category).Returns("Odd things");
        definition.SetupGet(x => x.EditorAlias).Returns("formulate-odd-field");
        definition.SetupGet(x => x.SupportsLabel).Returns(flag == nameof(FormFieldDefinitionModel.SupportsLabel));
        definition.SetupGet(x => x.SupportsValidation).Returns(flag == nameof(FormFieldDefinitionModel.SupportsValidation));
        definition.SetupGet(x => x.SupportsCategory).Returns(flag == nameof(FormFieldDefinitionModel.SupportsCategory));
        definition.SetupGet(x => x.IsServerSideOnly).Returns(flag == nameof(FormFieldDefinitionModel.IsServerSideOnly));
        definition.SetupGet(x => x.IsStored).Returns(flag == nameof(FormFieldDefinitionModel.IsStored));
        definition.SetupGet(x => x.IsHidden).Returns(flag == nameof(FormFieldDefinitionModel.IsHidden));
        _fields.Add(definition.Object);

        var model = Assert.Single(CreateService().GetFormFields());

        var trueFlags = typeof(FormFieldDefinitionModel).GetProperties()
            .Where(property => property.PropertyType == typeof(bool) && (bool)property.GetValue(model)!)
            .Select(property => property.Name);
        Assert.Equal(new[] { flag }, trueFlags);
        Assert.Equal(("Odd", "icon-odd", "Odd things", "formulate-odd-field"), (model.Name, model.Icon, model.Category, model.EditorAlias));
    }

    [Fact]
    public void Legacy_kinds_are_not_offered()
    {
        _fields.Add(new TextFieldDefinition());
        _fields.Add(LegacyField());
        _handlers.Add(LegacyHandler());

        var service = CreateService();

        Assert.Equal(new[] { Guid.Parse(TextFieldDefinition.Constants.KindId) }, service.GetFormFields().Select(x => x.KindId));
        Assert.Empty(service.GetFormHandlers());
    }

    [Fact]
    public void Form_handlers_carry_their_editor_alias_and_category()
    {
        var handler = new Mock<IFormHandlerDefinition>();
        handler.SetupGet(x => x.KindId).Returns(Guid.NewGuid());
        handler.SetupGet(x => x.Name).Returns("Send email");
        handler.SetupGet(x => x.Icon).Returns("icon-message");
        handler.SetupGet(x => x.Category).Returns("General");
        handler.SetupGet(x => x.EditorAlias).Returns("formulate-send-email-handler");
        handler.Setup(x => x.GetBackOfficeConfiguration(It.IsAny<IFormHandlerSettings>())).Returns(new { subject = "Hello" });
        _handlers.Add(handler.Object);

        var model = Assert.Single(CreateService().GetFormHandlers());

        Assert.Equal(("Send email", "icon-message", "General", "formulate-send-email-handler"), (model.Name, model.Icon, model.Category, model.EditorAlias));
        Assert.Equal("Hello", model.DefaultConfiguration!.Value.GetProperty("subject").GetString());
    }

    [Fact]
    public void Validations_flag_legacy_and_carry_the_editor_alias()
    {
        _validations.Add(new MandatoryValidationDefinition(_harness.JsonUtility));

        var model = Assert.Single(CreateService().GetValidations());

        Assert.Equal(Guid.Parse(MandatoryValidationDefinition.Constants.KindId), model.KindId);
        Assert.Equal("formulate-mandatory-validation", model.EditorAlias);
        Assert.False(model.IsLegacy);
        Assert.StartsWith("icon-", model.Icon);
    }

    [Fact]
    public void Data_values_include_legacy_kinds_flagged_and_use_built_in_icons()
    {
        _dataValues.Add(new ListDataValuesDefinition(_harness.JsonUtility));
        _dataValues.Add(new LegacyDataValuesDefinition());

        var models = CreateService().GetDataValues();

        Assert.Equal(new[] { false, true }, models.Select(x => x.IsLegacy));
        Assert.Equal(new[] { "formulate-list-data-values", "formulate-legacy-data-value" }, models.Select(x => x.EditorAlias));
        Assert.All(models, model => Assert.DoesNotContain("icon-formulate-", model.Icon));
    }

    [Fact]
    public void Layouts_carry_the_editor_alias()
    {
        _layouts.Add(new BasicLayoutDefinition(_harness.Forms, _harness.JsonUtility));

        var model = Assert.Single(CreateService().GetLayouts());

        Assert.Equal("formulate-layout-basic", model.EditorAlias);
        Assert.Equal(Guid.Parse(BasicLayoutDefinition.Constants.KindId), model.KindId);
        Assert.False(model.IsLegacy);
    }

    [Fact]
    public void Templates_are_listed_by_id_and_name()
    {
        var template = new Mock<ITemplateDefinition>();
        template.SetupGet(x => x.KindId).Returns(Guid.Parse("00000000-0000-0000-0000-0000000000bb"));
        template.SetupGet(x => x.Name).Returns("Plain JavaScript");
        _templates.Add(template.Object);

        var model = Assert.Single(CreateService().GetTemplates());

        Assert.Equal((Guid.Parse("00000000-0000-0000-0000-0000000000bb"), "Plain JavaScript"), (model.Id, model.Name));
    }

    [Fact]
    public void Default_configuration_is_what_the_definition_gives_for_empty_settings()
    {
        _fields.Add(new ButtonFieldDefinition(_harness.JsonUtility));

        var configuration = Assert.Single(CreateService().GetFormFields()).DefaultConfiguration;

        Assert.Equal(JsonValueKind.Object, configuration!.Value.ValueKind);
        Assert.Empty(_logger.Entries);
    }

    [Fact]
    public void Default_configuration_failure_yields_null()
    {
        var definition = new Mock<IValidationDefinition>();
        definition.SetupGet(x => x.KindId).Returns(Guid.NewGuid());
        definition.SetupGet(x => x.Name).Returns("Broken");
        definition.SetupGet(x => x.EditorAlias).Returns("formulate-broken");
        definition.Setup(x => x.GetBackOfficeConfiguration(It.IsAny<PersistedValidation>())).Throws<InvalidOperationException>();
        _validations.Add(definition.Object);

        var model = Assert.Single(CreateService().GetValidations());

        Assert.Null(model.DefaultConfiguration);
        var entry = Assert.Single(_logger.Entries);
        Assert.Equal(LogLevel.Debug, entry.Level);
        Assert.Contains("Broken", entry.Message);
    }

    [Fact]
    public void Default_configuration_is_null_when_the_definition_has_none()
    {
        _dataValues.Add(new LegacyDataValuesDefinition());

        Assert.Null(Assert.Single(CreateService().GetDataValues()).DefaultConfiguration);
        Assert.Empty(_logger.Entries);
    }
}
