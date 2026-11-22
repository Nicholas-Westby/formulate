using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Models.DataValues;
using Formulate.BackOffice.Api.Models.Form;
using Formulate.BackOffice.Api.Models.Layout;
using Formulate.BackOffice.Api.Models.Validation;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Configuration;
using Formulate.BackOffice.Definitions.Forms;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.BackOffice.Utilities;
using Formulate.Core.Configuration;
using Formulate.Core.DataValues;
using Formulate.Core.DataValues.Legacy;
using Formulate.Core.DataValues.List;
using Formulate.Core.DataValues.PairList;
using Formulate.Core.DataValues.UsStates;
using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Button;
using Formulate.Core.FormFields.CheckboxList;
using Formulate.Core.FormFields.DropDown;
using Formulate.Core.FormFields.Header;
using Formulate.Core.FormFields.Hidden;
using Formulate.Core.FormFields.RadioButtonList;
using Formulate.Core.FormFields.RichText;
using Formulate.Core.FormFields.Text;
using Formulate.Core.FormFields.TextArea;
using Formulate.Core.FormFields.TextConstant;
using Formulate.Core.FormFields.Upload;
using Formulate.Core.FormHandlers;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Templates;
using Formulate.Core.Utilities;
using Formulate.Core.Validations;
using Formulate.Core.Validations.Mandatory;
using Formulate.Core.Validations.Regex;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Umbraco.Cms.Core.Strings;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

/// <summary>
/// The client starts a new item from the default configuration the definitions endpoint gives its kind,
/// so the check on create must accept it for every kind Formulate ships.
/// </summary>
public class BuiltInKindDefaultsTests
{
    private static readonly Guid Template = Guid.Parse("00000000-0000-0000-0000-0000000000aa");

    private readonly TreeHarness _tree = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();

    private IJsonUtility JsonUtility => _tree.Repositories.JsonUtility;

    private ConfigurationJson ConfigurationJson => new(JsonUtility, _logger);

    private FormFieldDefinitionCollection Fields
    {
        get
        {
            var items = Mock.Of<IGetDataValuesItemsUtility>();

            return new FormFieldDefinitionCollection(() => new IFormFieldDefinition[]
            {
                new ButtonFieldDefinition(JsonUtility),
                new CheckboxListFieldDefinition(JsonUtility, items),
                new DropDownFieldDefinition(JsonUtility, items),
                new HeaderFieldDefinition(JsonUtility),
                new HiddenFieldDefinition(JsonUtility),
                new RadioButtonListFieldDefinition(JsonUtility, items),
                new RichTextFieldDefinition(JsonUtility),
                new TextFieldDefinition(),
                new TextAreaFieldDefinition(),
                new TextConstantFieldDefinition(JsonUtility),
                new UploadFieldDefinition(),
            });
        }
    }

    private ValidationDefinitionCollection Validations => new(() => new IValidationDefinition[]
    {
        new MandatoryValidationDefinition(JsonUtility),
        new RegexValidationDefinition(
            JsonUtility,
            Options.Create(new FormulateSubmissionsOptions()),
            NullLogger<RegexValidation>.Instance),
    });

    private DataValuesDefinitionCollection DataValues => new(() => new IDataValuesDefinition[]
    {
        new ListDataValuesDefinition(JsonUtility),
        new PairListDataValuesDefinition(JsonUtility),
        new UsStatesDataValuesDefinition(),
        new LegacyDataValuesDefinition(),
    });

    private LayoutDefinitionCollection Layouts => new(() => new ILayoutDefinition[]
    {
        new BasicLayoutDefinition(_tree.Repositories.Forms, JsonUtility),
    });

    private TemplateDefinitionCollection Templates
    {
        get
        {
            var template = new Mock<ITemplateDefinition>();
            template.SetupGet(x => x.KindId).Returns(Template);
            template.SetupGet(x => x.Name).Returns("Template");

            return new TemplateDefinitionCollection(() => new[] { template.Object });
        }
    }

    private DefinitionApiService Definitions()
    {
        var templates = Templates;

        return new(
            Fields,
            new FormHandlerDefinitionCollection(() => Array.Empty<IFormHandlerDefinition>()),
            Validations,
            DataValues,
            Layouts,
            templates,
            new GetDefaultTemplateId(templates, Options.Create(new FormulateBackOfficeOptions())),
            ConfigurationJson);
    }

    private static void AssertCreated<T>(ServiceResult<T> result, string kind) =>
        Assert.True(result.Status == ServiceStatus.Success, $"{kind}: {result.Status} {result.Field} {result.Message}");

    [Fact]
    public void Every_built_in_field_kind_accepts_its_default_configuration()
    {
        var kinds = Definitions().GetFormFields();
        var service = new FormApiService(
            _tree.Repositories.Forms,
            _tree.Repositories.Layouts,
            _tree.Tree,
            _tree.Repositories.FormDefinitions,
            Fields,
            new FormHandlerDefinitionCollection(() => Array.Empty<IFormHandlerDefinition>()),
            ConfigurationJson,
            new DefaultShortStringHelper(new DefaultShortStringHelperConfig()),
            _tree.Repositories.DefaultTemplateId,
            new ApiWriteLock());

        Assert.Equal(11, kinds.Count);

        foreach (var kind in kinds)
        {
            var field = new FormFieldModel { Id = Guid.NewGuid(), KindId = kind.KindId, Name = kind.Name, Configuration = kind.DefaultConfiguration };
            var request = new CreateFormRequestModel
            {
                Id = Guid.NewGuid(),
                KindId = new DefaultFormLayoutDefinition().KindId,
                Name = kind.Name,
                Fields = new[] { field },
                Handlers = Array.Empty<FormHandlerModel>(),
            };

            AssertCreated(service.Create(request), kind.Name);
        }
    }

    [Fact]
    public void Every_built_in_validation_kind_accepts_its_default_configuration()
    {
        var service = new ValidationApiService(_tree.Repositories.Validations, _tree.Tree, Validations, ConfigurationJson, new ApiWriteLock());
        var kinds = Definitions().GetValidations();

        Assert.Equal(2, kinds.Count);

        foreach (var kind in kinds)
        {
            AssertCreated(service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), KindId = kind.KindId, Name = kind.Name, Configuration = kind.DefaultConfiguration }), kind.Name);
        }
    }

    [Fact]
    public void Every_built_in_data_values_kind_that_can_be_created_accepts_its_default_configuration()
    {
        var service = new DataValuesApiService(_tree.Repositories.DataValues, _tree.Tree, DataValues, ConfigurationJson, new ApiWriteLock());
        var kinds = Definitions().GetDataValues().Where(x => !x.IsLegacy).ToArray();

        Assert.Equal(3, kinds.Length);

        foreach (var kind in kinds)
        {
            AssertCreated(service.Create(new CreateDataValuesRequestModel { Id = Guid.NewGuid(), KindId = kind.KindId, Name = kind.Name, Configuration = kind.DefaultConfiguration }), kind.Name);
        }
    }

    [Fact]
    public void Every_built_in_layout_kind_accepts_its_default_configuration()
    {
        var form = _tree.AddForm();
        var templates = Templates;
        var service = new LayoutApiService(
            _tree.Repositories.Layouts,
            _tree.Repositories.Forms,
            _tree.Tree,
            Layouts,
            templates,
            new GetDefaultTemplateId(templates, Options.Create(new FormulateBackOfficeOptions())),
            ConfigurationJson,
            new ApiWriteLock());

        var kind = Assert.Single(Definitions().GetLayouts());

        AssertCreated(service.Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = kind.KindId, Name = kind.Name, Configuration = kind.DefaultConfiguration }), kind.Name);
    }
}
