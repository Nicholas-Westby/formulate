using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Hidden;
using Formulate.Core.FormFields.Text;
using Formulate.Core.FormFields.TextArea;
using Formulate.Core.FormFields.TextConstant;
using Formulate.Core.FormFields.Upload;
using Formulate.Core.FormHandlers;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Core.Utilities;
using Formulate.Core.Utilities.Internal;
using Microsoft.Extensions.Primitives;

namespace Formulate.Extensions.SendEmail.Tests.TestSupport;

/// <summary>
/// Builds forms, fields and submissions the way the site gives them to handlers.
/// </summary>
internal static class TestForms
{
    public const string TextKind = TextFieldDefinition.Constants.KindId;

    public const string TextAreaKind = TextAreaFieldDefinition.Constants.KindId;

    public const string HiddenKind = HiddenFieldDefinition.Constants.KindId;

    public const string TextConstantKind = TextConstantFieldDefinition.Constants.KindId;

    public const string UploadKind = UploadFieldDefinition.Constants.KindId;

    /// <summary>
    /// Formulate 3's Date field.
    /// </summary>
    public const string DateKind = "E70CB78CCF52461198B4556382F23119";

    /// <summary>
    /// The JSON utility the site uses (Newtonsoft.Json with the data contract names).
    /// </summary>
    public static IJsonUtility Json { get; } = new JsonUtility(new NewtonsoftJsonSerializer());

    /// <summary>
    /// The field definitions Formulate installs that these tests use.
    /// </summary>
    public static FormFieldDefinitionCollection FieldDefinitions { get; } = new(() => new IFormFieldDefinition[]
    {
        new TextFieldDefinition(),
        new TextAreaFieldDefinition(),
        new HiddenFieldDefinition(Json),
        new TextConstantFieldDefinition(Json),
        new UploadFieldDefinition(),
    });

    public static PersistedFormField Field(string name, string kindId, string? alias = null, string? configuration = null)
    {
        return new PersistedFormField
        {
            Id = Guid.NewGuid(),
            KindId = Guid.Parse(kindId),
            Name = name,
            Alias = alias ?? string.Empty,
            Label = name,
            Data = configuration!,
        };
    }

    public static PersistedForm Form(params PersistedFormField[] fields)
    {
        return new PersistedForm
        {
            Id = Guid.NewGuid(),
            Name = "Contact Us",
            Alias = "contactUs",
            Fields = fields,
            Handlers = Array.Empty<PersistedFormHandler>(),
        };
    }

    public static SubmissionBuilder Submit(PersistedForm form) => new(form);
}

internal sealed class SubmissionBuilder(PersistedForm form)
{
    private readonly Dictionary<Guid, IStringFormFieldValues> _values = new();

    private readonly Dictionary<Guid, IFileFormFieldValues> _files = new();

    private readonly Dictionary<string, object> _extra = new();

    private int? _pageId;

    public SubmissionBuilder Value(PersistedFormField field, params string[] values)
    {
        _values[field.Id] = new StringFormFieldValues(new StringValues(values));
        return this;
    }

    public SubmissionBuilder File(PersistedFormField field, string name, byte[] data, string contentType = "application/octet-stream")
    {
        var existing = _files.TryGetValue(field.Id, out var current) ? current.GetValues() : Array.Empty<FormFileValue>();
        var file = new FormFileValue { Name = name, Data = data, ContentType = contentType };
        _files[field.Id] = new FilesFormFieldValues(existing.Append(file).ToArray());
        return this;
    }

    public SubmissionBuilder Extra(string key, object value)
    {
        _extra[key] = value;
        return this;
    }

    public SubmissionBuilder OnPage(int pageId)
    {
        _pageId = pageId;
        return this;
    }

    public FormSubmissionRequest Build()
    {
        return new FormSubmissionRequest(form, _pageId, _values, _files) { ExtraContext = _extra };
    }
}
