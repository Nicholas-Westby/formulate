using Formulate.Core.PropertyEditors;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.ContentEditing;
using Umbraco.Cms.Core.Models.ContentPublishing;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.PropertyEditors;
using Umbraco.Cms.Core.Serialization;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;

namespace Website.Seed;

/// <summary>
/// Seeds the dev site with what is needed to try the Form Layout Picker: a data type that uses it, a
/// document type and template that show the picked form, and a published page.
/// </summary>
/// <remarks>
/// It runs only in the Development environment, and makes each thing only if it is missing, so it can
/// run at every start. Like everything in this project, it is never packed.
/// </remarks>
public sealed class FormulateTestContentComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, FormulateTestContentSeeder>();
    }
}

/// <summary>
/// Makes the test content when the application has started.
/// </summary>
public sealed class FormulateTestContentSeeder : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
    internal const string DataTypeName = "Formulate Form";
    internal const string DocumentTypeAlias = "formulateTestPage";
    internal const string DocumentTypeName = "Formulate Test Page";
    internal const string TemplateAlias = "formulateTestPage";
    internal const string PropertyAlias = "form";
    internal const string PageName = "Contact Us";

    // Fixed, so the content can be found again, and so a second run knows it is already there.
    internal static readonly Guid DataTypeKey = new("5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a01");
    internal static readonly Guid DocumentTypeKey = new("5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a02");
    internal static readonly Guid PageKey = new("5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a03");

    // The template shows the picked form. The property is empty until a form is picked, and the
    // component needs a value to be called with, so the call is left out then.
    private const string TemplateContent = """
        @using Umbraco.Extensions
        @inherits Umbraco.Cms.Web.Common.Views.UmbracoViewPage
        @{
            Layout = null;
            var form = Model.Value<Formulate.Core.FormLayout>("form");
        }
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8" />
            <title>@Model.Name</title>
        </head>
        <body>
            <h1>@Model.Name</h1>
            @if (form is not null)
            {
                @await Component.InvokeAsync("FormulateForm", form)
            }
        </body>
        </html>
        """;

    private readonly IHostEnvironment _hostEnvironment;
    private readonly IRuntimeState _runtimeState;
    private readonly IDataTypeService _dataTypeService;
    private readonly IContentTypeService _contentTypeService;
    private readonly ITemplateService _templateService;
    private readonly IContentService _contentService;
    private readonly IContentEditingService _contentEditingService;
    private readonly IContentPublishingService _contentPublishingService;
    private readonly PropertyEditorCollection _propertyEditors;
    private readonly IConfigurationEditorJsonSerializer _configurationEditorJsonSerializer;
    private readonly IShortStringHelper _shortStringHelper;
    private readonly ILogger<FormulateTestContentSeeder> _logger;

    public FormulateTestContentSeeder(
        IHostEnvironment hostEnvironment,
        IRuntimeState runtimeState,
        IDataTypeService dataTypeService,
        IContentTypeService contentTypeService,
        ITemplateService templateService,
        IContentService contentService,
        IContentEditingService contentEditingService,
        IContentPublishingService contentPublishingService,
        PropertyEditorCollection propertyEditors,
        IConfigurationEditorJsonSerializer configurationEditorJsonSerializer,
        IShortStringHelper shortStringHelper,
        ILogger<FormulateTestContentSeeder> logger)
    {
        _hostEnvironment = hostEnvironment;
        _runtimeState = runtimeState;
        _dataTypeService = dataTypeService;
        _contentTypeService = contentTypeService;
        _templateService = templateService;
        _contentService = contentService;
        _contentEditingService = contentEditingService;
        _contentPublishingService = contentPublishingService;
        _propertyEditors = propertyEditors;
        _configurationEditorJsonSerializer = configurationEditorJsonSerializer;
        _shortStringHelper = shortStringHelper;
        _logger = logger;
    }

    public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
    {
        if (!_hostEnvironment.IsDevelopment() || _runtimeState.Level != RuntimeLevel.Run)
        {
            return;
        }

        try
        {
            var dataType = await EnsureDataTypeAsync();
            var contentType = await EnsureDocumentTypeAsync(dataType);
            await EnsurePageAsync(contentType);
        }
        catch (Exception exception)
        {
            // Seeding is a convenience: a failure must not stop the site.
            _logger.LogError(exception, "The Formulate test content could not be made.");
        }
    }

    private async Task<IDataType> EnsureDataTypeAsync()
    {
        var existing = await _dataTypeService.GetAsync(DataTypeKey);

        if (existing is not null)
        {
            return existing;
        }

        if (!_propertyEditors.TryGet(FormLayoutPickerPropertyValueConverter.PropertyEditorAlias, out var editor))
        {
            throw new InvalidOperationException("The Formulate Form Layout Picker property editor is not installed.");
        }

        var dataType = new DataType(editor, _configurationEditorJsonSerializer)
        {
            Key = DataTypeKey,
            Name = DataTypeName,
            // The back office picks the editor's UI from this alias, which the client registers.
            EditorUiAlias = "Formulate.PropertyEditorUi.FormLayoutPicker",
        };
        var result = await _dataTypeService.CreateAsync(dataType, Constants.Security.SuperUserKey);

        return result.Success
            ? result.Result
            : throw new InvalidOperationException($"The data type could not be created: {result.Status}.");
    }

    private async Task<ITemplate> EnsureTemplateAsync()
    {
        var existing = await _templateService.GetAsync(TemplateAlias);

        if (existing is not null)
        {
            return existing;
        }

        var result = await _templateService.CreateAsync(
            DocumentTypeName,
            TemplateAlias,
            TemplateContent,
            Constants.Security.SuperUserKey);

        return result.Success
            ? result.Result!
            : throw new InvalidOperationException($"The template could not be created: {result.Status}.");
    }

    private async Task<IContentType> EnsureDocumentTypeAsync(IDataType dataType)
    {
        var existing = await _contentTypeService.GetAsync(DocumentTypeKey);

        // The document type is the mark that the seed ran: a template renamed since is not made again.
        if (existing is not null)
        {
            return existing;
        }

        var template = await EnsureTemplateAsync();

        var contentType = new ContentType(_shortStringHelper, Constants.System.Root)
        {
            Key = DocumentTypeKey,
            Alias = DocumentTypeAlias,
            Name = DocumentTypeName,
            Icon = "icon-document",
            AllowedAsRoot = true,
        };
        contentType.AddPropertyType(
            new PropertyType(_shortStringHelper, dataType, PropertyAlias) { Name = "Form" },
            "content",
            "Content");
        contentType.AllowedTemplates = [template];
        contentType.SetDefaultTemplate(template);

        var result = await _contentTypeService.CreateAsync(contentType, Constants.Security.SuperUserKey);

        return result.Success
            ? contentType
            : throw new InvalidOperationException($"The document type could not be created: {result.Result}.");
    }

    private async Task EnsurePageAsync(IContentType contentType)
    {
        if (_contentService.GetById(PageKey) is not null)
        {
            return;
        }

        var created = await _contentEditingService.CreateAsync(
            new ContentCreateModel
            {
                Key = PageKey,
                ContentTypeKey = contentType.Key,
                ParentKey = null,
                TemplateKey = contentType.DefaultTemplate?.Key,
                Variants = [new VariantModel { Name = PageName }],
                Properties = [],
            },
            Constants.Security.SuperUserKey);

        if (!created.Success)
        {
            throw new InvalidOperationException($"The page could not be created: {created.Status}.");
        }

        var published = await _contentPublishingService.PublishAsync(
            PageKey,
            [new CulturePublishScheduleModel { Culture = "*" }],
            Constants.Security.SuperUserKey);

        if (!published.Success)
        {
            throw new InvalidOperationException($"The page could not be published: {published.Status}.");
        }
    }
}
