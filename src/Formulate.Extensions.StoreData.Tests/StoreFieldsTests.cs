using Formulate.Core.FormFields;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.StoreData.Utilities;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class StoreFieldsTests
{
    [Fact]
    public void A_field_posted_with_no_values_is_stored_as_empty_text()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "Nothing" };
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { field } };
        var values = new Dictionary<Guid, IStringFormFieldValues> { [field.Id] = new StringFormFieldValues(StringValues.Empty) };

        var entries = new StoreFields().Execute(new StoreFieldsInput(form, values));

        var entry = Assert.Single(entries);
        Assert.Equal(string.Empty, entry.Value);
    }
}
