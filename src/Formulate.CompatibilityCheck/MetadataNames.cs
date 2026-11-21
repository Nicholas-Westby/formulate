using System.Collections.Immutable;
using System.Reflection.Metadata;

namespace Formulate.CompatibilityCheck;

/// <summary>
/// Full type names ("Namespace.Type", nested types as "Outer/Inner") read from metadata.
/// </summary>
internal static class MetadataNames
{
    public static string Of(MetadataReader md, TypeDefinitionHandle handle)
    {
        var type = md.GetTypeDefinition(handle);
        var name = md.GetString(type.Name);

        if (type.IsNested)
        {
            return Of(md, type.GetDeclaringType()) + "/" + name;
        }

        var ns = md.GetString(type.Namespace);

        return ns.Length == 0 ? name : ns + "." + name;
    }

    public static string Of(MetadataReader md, TypeReferenceHandle handle)
    {
        var type = md.GetTypeReference(handle);
        var name = md.GetString(type.Name);

        if (type.ResolutionScope.Kind == HandleKind.TypeReference)
        {
            return Of(md, (TypeReferenceHandle)type.ResolutionScope) + "/" + name;
        }

        var ns = md.GetString(type.Namespace);

        return ns.Length == 0 ? name : ns + "." + name;
    }

    /// <summary>
    /// Gets the name of the assembly a type reference points to (for a nested type, its outer type's).
    /// </summary>
    public static string? RootAssembly(MetadataReader md, TypeReferenceHandle handle)
    {
        var type = md.GetTypeReference(handle);

        return type.ResolutionScope.Kind switch
        {
            HandleKind.AssemblyReference => md.GetString(md.GetAssemblyReference((AssemblyReferenceHandle)type.ResolutionScope).Name),
            HandleKind.TypeReference => RootAssembly(md, (TypeReferenceHandle)type.ResolutionScope),
            _ => null
        };
    }

    /// <summary>
    /// For a generic instantiation such as List&lt;int&gt;, gets the open generic type (List&lt;T&gt;).
    /// Any other handle is returned as it is.
    /// </summary>
    public static EntityHandle OpenGeneric(MetadataReader md, EntityHandle handle)
    {
        if (handle.Kind != HandleKind.TypeSpecification)
        {
            return handle;
        }

        var reader = md.GetBlobReader(md.GetTypeSpecification((TypeSpecificationHandle)handle).Signature);

        if (reader.ReadSignatureTypeCode() != SignatureTypeCode.GenericTypeInstance)
        {
            return handle;
        }

        reader.ReadSignatureTypeCode(); // class or valuetype

        return reader.ReadTypeHandle();
    }
}

/// <summary>
/// Formats signatures as text, so a reference and a definition match when their texts are equal.
/// </summary>
internal sealed class SignatureFormatter : ISignatureTypeProvider<string, object?>
{
    public static readonly SignatureFormatter Instance = new();

    public static string Method(MethodSignature<string> signature)
    {
        var instance = signature.Header.IsInstance ? "instance " : "";

        return $"{instance}{signature.ReturnType} `{signature.GenericParameterCount}({string.Join(",", signature.ParameterTypes)})";
    }

    public static string Field(string type) => "field " + type;

    public string GetArrayType(string elementType, ArrayShape shape) => $"{elementType}[{shape.Rank}]";

    public string GetByReferenceType(string elementType) => elementType + "&";

    public string GetFunctionPointerType(MethodSignature<string> signature) => "fnptr";

    public string GetGenericInstantiation(string genericType, ImmutableArray<string> typeArguments) =>
        $"{genericType}<{string.Join(",", typeArguments)}>";

    public string GetGenericMethodParameter(object? genericContext, int index) => "!!" + index;

    public string GetGenericTypeParameter(object? genericContext, int index) => "!" + index;

    public string GetModifiedType(string modifier, string unmodifiedType, bool isRequired) =>
        isRequired ? $"{unmodifiedType} modreq({modifier})" : unmodifiedType;

    public string GetPinnedType(string elementType) => elementType;

    public string GetPointerType(string elementType) => elementType + "*";

    public string GetPrimitiveType(PrimitiveTypeCode typeCode) => typeCode.ToString();

    public string GetSZArrayType(string elementType) => elementType + "[]";

    public string GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind) =>
        MetadataNames.Of(reader, handle);

    public string GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind) =>
        MetadataNames.Of(reader, handle);

    public string GetTypeFromSpecification(MetadataReader reader, object? genericContext, TypeSpecificationHandle handle, byte rawTypeKind) =>
        reader.GetTypeSpecification(handle).DecodeSignature(this, genericContext);
}
