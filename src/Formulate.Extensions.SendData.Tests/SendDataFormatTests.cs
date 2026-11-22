using Formulate.Core.Forms;
using Formulate.Extensions.SendData.Tests.TestSupport;
using static Formulate.Extensions.SendData.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// The exact request each transmission format makes, against a fake network.
/// </summary>
public sealed class SendDataFormatTests
{
    private const string FormUrlEncoded = "application/x-www-form-urlencoded";

    private const string Json = "application/json; charset=utf-8";

    private readonly PersistedFormField _name = Field("Full name", TextKind, "name");

    private readonly PersistedFormField _tags = Field("Tags", TextKind, "tags");

    private PersistedForm Form() => TestForms.Form(_name, _tags);

    private FormSubmissionRequest Submission(PersistedForm form) =>
        Submit(form).Value(_name, "Ann Lee").Value(_tags, "a", "b").Build();

    private object Config(string url, string method, string format) => new
    {
        url,
        method,
        transmissionFormat = format,
        fields = new[] { new { id = _name.Id.ToString("N"), name = "Name" }, new { id = _tags.Id.ToString("N"), name = "Tags" } },
    };

    [Fact]
    public async Task Query_string_get_appends_the_data_to_the_url()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in?x=1", "GET", "Query String"), Submission(Form()));

        var request = services.Network.Single;
        Assert.Equal("GET /in?x=1&Name=Ann+Lee&Tags=a%2C+b", request.RequestLine);
        Assert.Null(request.Body);
    }

    [Fact]
    public async Task Query_string_post_sends_an_empty_body_with_the_query()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in", "POST", "Query String"), Submission(Form()));

        var request = services.Network.Single;
        Assert.Equal("POST /in?Name=Ann+Lee&Tags=a%2C+b", request.RequestLine);
        Assert.Equal(string.Empty, request.Body);
        Assert.Equal(0, request.ContentLength);
    }

    [Fact]
    public async Task Form_body_sends_the_urls_own_query_values_and_the_data_leaving_the_url_as_it_was()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in?x=1", "POST", "Form Body"), Submission(Form()));

        var request = services.Network.Single;
        Assert.Equal("POST /in?x=1", request.RequestLine);
        Assert.Equal(FormUrlEncoded, request.ContentType);
        Assert.Equal("x=1&Name=Ann+Lee&Tags=a%2C+b", request.Body);
    }

    [Fact]
    public async Task Form_body_without_a_query_in_the_url_sends_just_the_data()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in", "POST", "Form Body"), Submission(Form()));

        Assert.Equal("Name=Ann+Lee&Tags=a%2C+b", services.Network.Single.Body);
    }

    [Fact]
    public async Task A_repeated_key_in_the_url_is_replaced_by_one_value_in_place()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in?a=1&Name=x&b=2&name=y", "GET", "Query String"), Submission(Form()));

        Assert.Equal("GET /in?a=1&Name=Ann+Lee&b=2&Tags=a%2C+b", services.Network.Single.RequestLine);
    }

    [Theory]
    [InlineData("Query String", "GET /in?name=Ann+Lee&x=1&Tags=a%2C+b", null)]
    [InlineData("Form Body", "POST /in?name=old&x=1", "name=Ann+Lee&x=1&Tags=a%2C+b")]
    public async Task A_mapping_replaces_a_urls_own_value_with_the_same_name_ignoring_case(string format, string requestLine, string? body)
    {
        await using var services = SendDataTestServices.Create();
        var method = format == "Query String" ? "GET" : "POST";

        await services.SendAsync(Config("http://hook.test/in?name=old&x=1", method, format), Submission(Form()));

        // The mapped "Name" takes the place of the URL's "name", which keeps its spelling and position, as NameValueCollection.Set did.
        var request = services.Network.Single;
        Assert.Equal(requestLine, request.RequestLine);
        Assert.Equal(body, request.Body);
    }

    [Theory]
    [InlineData("Query String", "GET", "GET /in?who=a%2C+b", null)]
    [InlineData("Form Body", "POST", "POST /in", "who=a%2C+b")]
    public async Task Two_mappings_with_the_same_name_keep_the_last_value_in_the_query_and_form_body(string format, string method, string requestLine, string? body)
    {
        await using var services = SendDataTestServices.Create();
        var config = new
        {
            url = "http://hook.test/in",
            method,
            transmissionFormat = format,
            fields = new[] { new { id = _name.Id.ToString("N"), name = "who" }, new { id = _tags.Id.ToString("N"), name = "WHO" } },
        };

        await services.SendAsync(config, Submission(Form()));

        var request = services.Network.Single;
        Assert.Equal(requestLine, request.RequestLine);
        Assert.Equal(body, request.Body);
    }

    [Fact]
    public async Task Json_sends_an_object_with_each_fields_values_joined()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in", "POST", "JSON"), Submission(Form()));

        var request = services.Network.Single;
        Assert.Equal("POST /in", request.RequestLine);
        Assert.Equal(Json, request.ContentType);
        Assert.Equal("{\"Name\":\"Ann Lee\",\"Tags\":\"a, b\"}", request.Body);
    }

    [Fact]
    public async Task Hubspot_json_sends_fields_and_the_page_context()
    {
        await using var services = SendDataTestServices.Create();
        services.Pages.Url = "https://site.test/contact";
        services.Pages.Name = "Contact";

        await services.SendAsync(Config("https://api.hubapi.test/submit", "POST", "HubSpot JSON"), Submit(Form()).Value(_name, "Ann Lee").Value(_tags, "a", "b").OnPage(1234).Build());

        var request = services.Network.Single;
        Assert.Equal("POST /submit", request.RequestLine);
        Assert.Equal(Json, request.ContentType);
        Assert.Equal(
            "{\"fields\":[{\"name\":\"Name\",\"value\":\"Ann Lee\"},{\"name\":\"Tags\",\"value\":\"a, b\"}],\"context\":{\"pageUri\":\"https://site.test/contact\",\"pageName\":\"Contact\"}}",
            request.Body);
    }

    [Theory]
    [InlineData("json", "application/json; charset=utf-8")]
    [InlineData("FORM BODY", FormUrlEncoded)]
    [InlineData("hubspot json", "application/json; charset=utf-8")]
    public async Task Format_is_matched_ignoring_case(string format, string contentType)
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in", "POST", format), Submission(Form()));

        Assert.Equal(contentType, services.Network.Single.ContentType);
    }

    [Fact]
    public async Task Unknown_format_sends_nothing_and_logs_a_warning()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("http://hook.test/in", "POST", "XML"), Submission(Form()));

        Assert.Empty(services.Network.Requests);
        var warning = Assert.Single(services.Logs.Warnings);
        Assert.Contains("XML", warning.Message);
        Assert.Contains("Send to the CRM", warning.Message);
    }

    [Fact]
    public async Task Mapping_renames_and_orders_fields()
    {
        var other = Field("Email", TextKind, "email");
        var form = TestForms.Form(_name, _tags, other);
        await using var services = SendDataTestServices.Create();

        // The mapping lists the email first, renames it, and leaves out the tags.
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = other.Id.ToString("N"), name = "contact_email" }, new { id = _name.Id.ToString("D"), name = "full_name" } },
        };

        await services.SendAsync(config, Submit(form).Value(_name, "Ann Lee").Value(_tags, "a").Value(other, "ann@site.test").Build());

        Assert.Equal("{\"contact_email\":\"ann@site.test\",\"full_name\":\"Ann Lee\"}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Empty_mapping_sends_no_fields_but_still_sends_the_request()
    {
        await using var services = SendDataTestServices.Create();
        var form = Form();
        var submission = Submission(form);

        foreach (var (format, method) in new[] { ("JSON", "POST"), ("Form Body", "POST"), ("Query String", "GET"), ("HubSpot JSON", "POST") })
        {
            await services.SendAsync(
                new { url = "http://hook.test/in", method, transmissionFormat = format, fields = Array.Empty<object>() }, submission);
        }

        Assert.Equal(4, services.Network.Requests.Count);
        Assert.Equal("{}", services.Network.Requests[0].Body);
        Assert.Equal(string.Empty, services.Network.Requests[1].Body);
        Assert.Equal("GET /in", services.Network.Requests[2].RequestLine);
        Assert.Equal("{\"fields\":[],\"context\":{}}", services.Network.Requests[3].Body);
    }

    [Fact]
    public async Task Missing_mapping_is_the_same_as_an_empty_one()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(new { url = "http://hook.test/in", method = "POST", transmissionFormat = "JSON" }, Submission(Form()));

        Assert.Equal("{}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Two_mappings_with_the_same_name_make_a_json_array()
    {
        await using var services = SendDataTestServices.Create();
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = _name.Id.ToString("N"), name = "who" }, new { id = _tags.Id.ToString("N"), name = "who" } },
        };

        await services.SendAsync(config, Submission(Form()));

        Assert.Equal("{\"who\":[\"Ann Lee\",\"a, b\"]}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Field_with_no_alias_is_named_by_its_name_when_the_mapping_has_no_name()
    {
        var noAlias = Field("Phone number", TextKind);
        await using var services = SendDataTestServices.Create();
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = noAlias.Id.ToString("N"), name = " " } },
        };

        await services.SendAsync(config, Submit(TestForms.Form(noAlias)).Value(noAlias, "555").Build());

        Assert.Equal("{\"Phone number\":\"555\"}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Mapped_field_the_form_does_not_have_or_without_a_name_is_handled()
    {
        await using var services = SendDataTestServices.Create();
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = Guid.NewGuid().ToString("N"), name = "gone" }, new { id = _name.Id.ToString("N"), name = "" } },
        };

        await services.SendAsync(config, Submission(Form()));

        // The field the form does not have is left out; the unnamed one uses its alias.
        Assert.Equal("{\"name\":\"Ann Lee\"}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Mapped_text_constant_sends_its_text()
    {
        var constant = Field("Source", TextConstantKind, "source", "{\"text\":\"website\"}");
        var form = TestForms.Form(_name, constant);
        await using var services = SendDataTestServices.Create();
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = _name.Id.ToString("N"), name = "Name" }, new { id = constant.Id.ToString("N"), name = "Source" } },
        };

        await services.SendAsync(config, Submit(form).Value(_name, "Ann Lee").Build());

        Assert.Equal("{\"Name\":\"Ann Lee\",\"Source\":\"website\"}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Non_http_url_is_not_called()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("file:///etc/passwd", "POST", "JSON"), Submission(Form()));

        Assert.Empty(services.Network.Requests);
        Assert.Contains("file:///etc/passwd", Assert.Single(services.Logs.Errors).Message);
    }
}
