using System.Reflection;
using System.Runtime.CompilerServices;
using Formulate.Core.DataValues;
using Formulate.Core.FormFields;
using Formulate.Core.FormHandlers;
using Formulate.Core.Types;
using Formulate.Extensions.SendData.FormHandlers;
using Formulate.Extensions.SendEmail.DesignedEmail;
using Formulate.Extensions.StoreData.FormHandlers;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

/// <summary>
/// Pins the icon of every built-in field, handler and data values kind to a name from Umbraco's own icon set.
/// </summary>
public class BuiltInKindIconsTests
{
    private static readonly Dictionary<string, string> Expected = new(StringComparer.OrdinalIgnoreCase)
    {
        ["1790658086EA440BBC309E1B099F803B"] = "icon-autofill", // Text field
        ["9DA843594D0B494491449F8CCAE7A4DA"] = "icon-edit", // Text Area
        ["6D3DF1571BC44FCFB2B70A94FE719B47"] = "icon-list", // Drop Down
        ["02DBA5DA4B93439EB63F43392E443DCF"] = "icon-bulleted-list", // Checkbox List
        ["E5F42754D82D468DBCBFCEE115E9563D"] = "icon-target", // Radio Button List
        ["8B277AF31B1F469897D23900C6621C7D"] = "icon-record", // Extended Radio Button List
        ["99C1A656C7A644ACA787C18593327310"] = "icon-checkbox", // Checkbox
        ["E70CB78CCF52461198B4556382F23119"] = "icon-calendar-alt", // Date
        ["DFEFA5EC02004806A2AB0AB22058021D"] = "icon-download-alt", // Upload
        ["3DF6FACD2FFA4055B0BE94E8FA8E7C4A"] = "icon-readonly", // Hidden
        ["6383DD2C68BD482B95DB811D09D01BC8"] = "icon-heading", // Header
        ["6FCDFDC9293F4913B762F4BA502216EB"] = "icon-browser-window", // Rich Text
        ["D9B1A60A11864440887B93195C760B5E"] = "icon-tag", // Text Constant
        ["CDE8565C5E9241129A1F7FFA1940C53C"] = "icon-mouse-cursor", // Button
        ["80C0543D419E4DDFAB052C2D052B97A2"] = "icon-shield", // reCAPTCHA
        ["A0C06033CB94424F9C035B10A420DB16"] = "icon-message", // Email handler
        ["15BE7A7D179D40A59AD034B71DAC52D4"] = "icon-newspaper", // Designed Email handler
        ["C76E8D1D5DF244CB8FA285C32312D688"] = "icon-cloud-upload", // Send Data handler
        ["238EA92071F44D8C9CC433D7181C9C46"] = "icon-database", // Store Data handler
        ["3106D817ABFC4D46A9B1ABA8B8F87F39"] = "icon-ordered-list", // List data values
        ["753A9598804448E39BC6200AC39E1D27"] = "icon-tags", // Pair List data values
        ["6CFFC488670E4CC7B965A5F3676BA333"] = "icon-map-location", // US States data values
        ["BBF66F6A8F7D4ABA9D5B194A46084EC2"] = "icon-block", // Legacy data values
    };

    private static Dictionary<string, string> Actual()
    {
        // Every definition derives its kind ID and icon from constants, so no services are needed.
        var assemblies = new[]
        {
            typeof(IFormFieldDefinition).Assembly,
            typeof(SendDataFormHandlerDefinition).Assembly,
            typeof(DesignedEmailFormHandlerDefinition).Assembly,
            typeof(StoreDataFormHandlerDefinition).Assembly,
        }.Distinct();

        return assemblies
            .SelectMany(x => x.GetTypes())
            .Where(x => x is { IsAbstract: false, IsInterface: false }
                && (typeof(IFormFieldDefinition).IsAssignableFrom(x)
                    || typeof(IFormHandlerDefinition).IsAssignableFrom(x)
                    || typeof(IDataValuesDefinition).IsAssignableFrom(x)))
            .Select(x => RuntimeHelpers.GetUninitializedObject(x))
            .ToDictionary(x => ((IDefinition)x).KindId.ToString("N").ToUpperInvariant(), IconOf);
    }

    private static string IconOf(object definition) => definition switch
    {
        IFormFieldDefinition field => field.Icon,
        IFormHandlerDefinition handler => handler.Icon,
        IDataValuesDefinition values => values.Icon,
        _ => throw new InvalidOperationException(definition.GetType().Name),
    };

    [Fact]
    public void Every_built_in_kind_has_the_icon_of_Umbraco_chosen_for_it()
    {
        var actual = Actual();

        foreach (var (kindId, icon) in Expected)
        {
            Assert.True(actual.ContainsKey(kindId), $"No definition has kind ID {kindId}.");
            Assert.Equal(icon, actual[kindId]);
        }
    }

    [Fact]
    public void No_built_in_kind_is_missing_from_the_pinned_list()
    {
        var actual = Actual();

        Assert.Empty(actual.Keys.Except(Expected.Keys, StringComparer.OrdinalIgnoreCase));
    }

    [Fact]
    public void No_built_in_kind_uses_the_old_icon_font()
    {
        Assert.All(Actual().Values, icon => Assert.DoesNotContain("icon-formulate-", icon));
    }
}
