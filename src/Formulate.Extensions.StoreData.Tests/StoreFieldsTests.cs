using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Date;
using Formulate.Core.FormFields.Recaptcha;
using Formulate.Core.FormFields.Text;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.StoreData.Utilities;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class StoreFieldsTests
{
    private static readonly FormFieldDefinitionCollection Definitions = new(() => new IFormFieldDefinition[]
    {
        new TextFieldDefinition(),
        new DateFieldDefinition(),
        new RecaptchaFieldDefinition(
            Microsoft.Extensions.Options.Options.Create(new Formulate.Core.Configuration.FormulateRecaptchaOptions()),
            new UnusedVerifier(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<RecaptchaFieldDefinition>.Instance),
    });

    private static PersistedFormField Field(string name, string kindId) =>
        new() { Id = Guid.NewGuid(), KindId = Guid.Parse(kindId), Name = name };

    [Fact]
    public void A_field_whose_definition_is_not_stored_is_skipped()
    {
        var name = Field("Name", TextFieldDefinition.Constants.KindId);
        var robot = Field("Robot check", RecaptchaFieldDefinition.Constants.KindId);
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { name, robot } };
        var values = new Dictionary<Guid, IStringFormFieldValues>
        {
            [name.Id] = new StringFormFieldValues("Ada"),
            [robot.Id] = new StringFormFieldValues("03AGdBq-TOKEN"),
        };

        var entries = new StoreFields(Definitions).Execute(new StoreFieldsInput(form, values));

        var entry = Assert.Single(entries);
        Assert.Equal("Ada", entry.Value);
    }

    [Fact]
    public void A_field_whose_kind_is_not_installed_is_still_stored()
    {
        var unknown = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "Gone" };
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { unknown } };
        var values = new Dictionary<Guid, IStringFormFieldValues> { [unknown.Id] = new StringFormFieldValues("kept") };

        var entry = Assert.Single(new StoreFields(Definitions).Execute(new StoreFieldsInput(form, values)));

        Assert.Equal("kept", entry.Value);
    }

    [Fact]
    public void A_date_is_stored_as_posted()
    {
        var date = Field("Start date", DateFieldDefinition.Constants.KindId);
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { date } };
        var values = new Dictionary<Guid, IStringFormFieldValues> { [date.Id] = new StringFormFieldValues("2026-11-05") };

        var entry = Assert.Single(new StoreFields(Definitions).Execute(new StoreFieldsInput(form, values)));

        Assert.Equal("2026-11-05", entry.Value);
    }

    private sealed class UnusedVerifier : IRecaptchaVerifier
    {
        public Task<RecaptchaVerification> VerifyAsync(string secretKey, string token, CancellationToken cancellationToken) => throw new NotSupportedException();
    }

    [Fact]
    public void A_field_posted_with_no_values_is_stored_as_empty_text()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "Nothing" };
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { field } };
        var values = new Dictionary<Guid, IStringFormFieldValues> { [field.Id] = new StringFormFieldValues(StringValues.Empty) };

        var entries = new StoreFields(Definitions).Execute(new StoreFieldsInput(form, values));

        var entry = Assert.Single(entries);
        Assert.Equal(string.Empty, entry.Value);
    }
}
